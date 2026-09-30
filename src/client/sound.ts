/**
 * Chime synthesis.
 *
 * Every voice is built from oscillators and gain envelopes at playback time.
 * That is a deliberate choice, not a shortcut: a Web client bundle is a single
 * CommonJS factory with no module table for assets, so shipping audio would mean
 * base64-inlining it into `lib/client.js`. Synthesized voices keep the bundle
 * small, keep the plugins's output free of binary blobs, and let one volume
 * control the whole set.
 *
 * @module dsh-your-turn/client/sound
 */

import type { PlayableSoundPreset, SoundPreset } from '../shared/settings.ts'
import { FALLBACK_SOUND_PRESET, SOUND_PRESETS } from '../shared/settings.ts'

/** One scheduled tone. */
interface Tone {
  /** Frequency in Hz at `at`. */
  freq: number
  /** Optional frequency to glide to over `dur`. */
  glideTo?: number
  /** Oscillator waveform. */
  type: OscillatorType
  /** Offset from the start of the voice, in seconds. */
  at: number
  /** Duration in seconds. */
  dur: number
  /** Peak gain, before the master volume. */
  gain: number
}

const VOICES: Record<PlayableSoundPreset, readonly Tone[]> = {
  // A soft two-partial bell: root plus a fifth, long exponential tail.
  chime: [
    { freq: 880, type: 'sine', at: 0, dur: 1.1, gain: 0.5 },
    { freq: 1320, type: 'sine', at: 0.02, dur: 0.85, gain: 0.24 },
    { freq: 2637, type: 'sine', at: 0, dur: 0.12, gain: 0.08 },
  ],
  // The smallest possible acknowledgement.
  ping: [{ freq: 1180, type: 'sine', at: 0, dur: 0.18, gain: 0.5 }],
  // Wooden attack: a strong fundamental with a bright, fast partial.
  marimba: [
    { freq: 523.25, type: 'sine', at: 0, dur: 0.5, gain: 0.55 },
    { freq: 1046.5, type: 'sine', at: 0, dur: 0.22, gain: 0.28 },
    { freq: 1568, type: 'sine', at: 0, dur: 0.08, gain: 0.1 },
  ],
  // Three rising square steps.
  arcade: [
    { freq: 659.25, type: 'square', at: 0, dur: 0.075, gain: 0.16 },
    { freq: 880, type: 'square', at: 0.075, dur: 0.075, gain: 0.16 },
    { freq: 1318.5, type: 'square', at: 0.15, dur: 0.14, gain: 0.15 },
  ],
  // A downward droplet.
  drop: [{ freq: 900, glideTo: 330, type: 'sine', at: 0, dur: 0.34, gain: 0.42 }],
  // A tri-tone for failures: deliberately not the success shape.
  alert: [
    { freq: 780, type: 'triangle', at: 0, dur: 0.16, gain: 0.36 },
    { freq: 590, type: 'triangle', at: 0.17, dur: 0.16, gain: 0.36 },
    { freq: 780, type: 'triangle', at: 0.34, dur: 0.22, gain: 0.34 },
  ],
}

/** A narrow structural face over the `AudioContext` constructor, for non-browser hosts. */
interface AudioContextLike {
  currentTime: number
  state: string
  destination: AudioNode
  resume(): Promise<void>
  close(): Promise<void>
  createGain(): GainNode
  createOscillator(): OscillatorNode
}

type AudioContextCtor = new () => AudioContextLike

/**
 * Narrow a raw preset string to a voice this build knows.
 * @param value - configured preset value.
 * @returns a playable preset, or `none`.
 */
export function resolvePreset(value: unknown): SoundPreset {
  if (typeof value === 'string' && (SOUND_PRESETS as readonly string[]).includes(value)) {
    return value as SoundPreset
  }
  return FALLBACK_SOUND_PRESET
}

/**
 * The page's audio output. One instance per plugin instance.
 *
 * Playback is best-effort by design: a browser that has not seen a user gesture
 * keeps its `AudioContext` suspended, so the first chime before any interaction
 * is silently dropped rather than throwing into the render path.
 */
export class SoundEngine {
  private context: AudioContextLike | undefined
  private master: GainNode | undefined
  private unavailable = false

  /**
   * Create or resume the output device.
   *
   * Call this from a user gesture (the settings Preview button, or the first
   * pointer or key event) so the browser releases audio autoplay.
   *
   * @returns whether audio is live after the attempt.
   */
  async unlock(): Promise<boolean> {
    const context = this.ensureContext()
    if (context === undefined) return false
    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch (error) {
        console.warn('[dsh-your-turn] audio resume failed', error)
        return false
      }
    }
    return context.state === 'running'
  }

  /** @returns whether the output device currently accepts playback. */
  isUnlocked(): boolean {
    return this.context !== undefined && this.context.state === 'running'
  }

  /**
   * Play one voice.
   * @param preset - configured voice; `none` or an unknown value plays nothing.
   * @param volume - 0-100, applied on top of the per-voice gain.
   */
  play(preset: SoundPreset, volume: number): void {
    if (preset === 'none' || volume <= 0) return
    const context = this.ensureContext()
    if (context === undefined || this.master === undefined) return
    // Writing the gain once per playback keeps the slider live without a
    // second state channel.
    this.master.gain.value = Math.max(0, Math.min(100, volume)) / 100 * 0.4
    const voice = VOICES[preset]
    if (voice === undefined) return
    if (context.state === 'suspended') {
      // Scheduled tones would be lost anyway; resuming first is what makes the
      // very first reminder audible in a page the user has already touched.
      void context.resume().catch(() => undefined)
    }
    for (const tone of voice) this.schedule(context, tone)
  }

  /** Release the output device. */
  dispose(): void {
    const context = this.context
    this.context = undefined
    this.master = undefined
    if (context === undefined) return
    void context.close().catch(() => undefined)
  }

  /** @returns the live master gain node, creating the graph on first use. */
  private ensureContext(): AudioContextLike | undefined {
    if (this.context !== undefined) return this.context
    if (this.unavailable) return undefined
    const ctor = audioContextConstructor()
    if (ctor === undefined) {
      this.unavailable = true
      console.warn('[dsh-your-turn] Web Audio is unavailable; chimes are disabled')
      return undefined
    }
    try {
      const context = new ctor()
      const master = context.createGain()
      master.gain.value = 0
      master.connect(context.destination)
      this.context = context
      this.master = master
      return context
    } catch (error) {
      this.unavailable = true
      console.warn('[dsh-your-turn] audio initialisation failed', error)
      return undefined
    }
  }

  /** Schedule one tone with a click-free attack and an exponential tail. */
  private schedule(context: AudioContextLike, tone: Tone): void {
    const master = this.master
    if (master === undefined) return
    try {
      const start = context.currentTime + tone.at
      const attack = Math.min(0.012, tone.dur * 0.25)
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      oscillator.type = tone.type
      oscillator.frequency.setValueAtTime(tone.freq, start)
      if (tone.glideTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(tone.glideTo, start + tone.dur)
      }
      envelope.gain.setValueAtTime(0.0001, start)
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, tone.gain), start + attack)
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur)
      oscillator.connect(envelope)
      envelope.connect(master)
      oscillator.start(start)
      oscillator.stop(start + tone.dur + 0.03)
    } catch (error) {
      console.warn('[dsh-your-turn] chime scheduling failed', error)
    }
  }
}

/** @returns the window's `AudioContext` constructor, when one exists. */
function audioContextConstructor(): AudioContextCtor | undefined {
  const global = globalThis as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return global.AudioContext ?? global.webkitAudioContext
}
