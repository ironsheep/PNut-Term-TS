/**
 * PersistenceManager - Manages circular buffer for sample persistence in SCOPE_XY display
 *
 * Implements a 2048-sample circular buffer with opacity-based fading for visual persistence.
 * Snake/Queue Model: Tracks sample age for stable opacity (no flicker on new samples).
 */
export class PersistenceManager {
  // Pascal: XY_Sets = DataSets = 1 shl DataSetsExp = 2048
  private static readonly BUFFER_SIZE = 2048;
  private static readonly PTR_MASK = PersistenceManager.BUFFER_SIZE - 1;

  // Sample with timestamp for age-based opacity
  private sampleBuffer: Array<{ data: number[], frameNumber: number }> = [];
  private samplePtr: number = 0;
  private samplePop: number = 0; // Number of valid samples in buffer
  private persistence: number = 256; // Number of samples to keep (0 = infinite)
  private currentFrame: number = 0; // Global frame counter for age tracking

  constructor() {
    this.clear();
  }

  /**
   * Set the persistence level (number of samples to keep)
   * @param samples Number of samples (0 for infinite, 1-512 for fading)
   */
  public setPersistence(samples: number): void {
    this.persistence = Math.max(0, Math.min(512, samples));
    
    // If reducing persistence, adjust population
    if (this.persistence > 0 && this.samplePop > this.persistence) {
      this.samplePop = this.persistence;
    }
  }

  /**
   * Add a sample to the circular buffer
   * @param channelData Array of channel data (X,Y pairs)
   */
  public addSample(channelData: number[]): void {
    // Increment frame counter for age tracking
    this.currentFrame++;

    // Store sample with timestamp at current pointer position
    this.sampleBuffer[this.samplePtr] = {
      data: [...channelData],
      frameNumber: this.currentFrame
    };

    // Advance pointer with wraparound using mask
    // Pascal: SamplePtr := (SamplePtr + 1) and XY_PtrMask;
    this.samplePtr = (this.samplePtr + 1) & PersistenceManager.PTR_MASK;

    // Update population count
    // Pascal: if SamplePop < vSamples then Inc(SamplePop);
    if (this.persistence > 0) {
      if (this.samplePop < this.persistence) {
        this.samplePop++;
      }
    } else {
      // Infinite persistence - keep all samples up to buffer size
      if (this.samplePop < PersistenceManager.BUFFER_SIZE) {
        this.samplePop++;
      }
    }
  }

  /**
   * Get all samples with calculated opacity for rendering
   * Snake Model: Opacity based on age (frame number), not position
   *
   * @returns Array of samples with opacity values
   */
  public getSamplesWithOpacity(): Array<{ data: number[]; opacity: number }> {
    const result: Array<{ data: number[]; opacity: number }> = [];

    if (this.persistence === 0) {
      // Infinite persistence - all samples at full opacity
      for (let i = 0; i < this.samplePop; i++) {
        const ptr = (this.samplePtr - i - 1) & PersistenceManager.PTR_MASK;
        const sample = this.sampleBuffer[ptr];
        if (sample && sample.data) {
          result.push({
            data: sample.data,
            opacity: 255
          });
        }
      }
    } else {
      // Fading persistence - calculate opacity based on AGE not position
      // This is the key change for the snake model!
      for (let i = 0; i < this.samplePop; i++) {
        const ptr = (this.samplePtr - i - 1) & PersistenceManager.PTR_MASK;
        const sample = this.sampleBuffer[ptr];
        if (sample && sample.data) {
          // Calculate age in frames
          const age = this.currentFrame - sample.frameNumber;

          // Skip samples that are too old
          if (age >= this.persistence) continue;

          // Calculate opacity based on age (newer = brighter)
          // No quantization for smooth gradient
          const opacity = 255 - Math.floor((age * 255) / this.persistence);

          result.push({
            data: sample.data,
            opacity: Math.max(1, Math.min(255, opacity))
          });
        }
      }
    }

    return result;
  }

  /**
   * Clear the buffer and reset pointers
   */
  public clear(): void {
    this.sampleBuffer = new Array(PersistenceManager.BUFFER_SIZE);
    this.samplePtr = 0;
    this.samplePop = 0;
    this.currentFrame = 0; // Reset frame counter
  }

  /**
   * Get the current number of samples in the buffer
   */
  public getSampleCount(): number {
    return this.samplePop;
  }

  /**
   * Get the maximum buffer size
   */
  public getBufferSize(): number {
    return PersistenceManager.BUFFER_SIZE;
  }

  /**
   * Get the current persistence setting
   */
  public getPersistence(): number {
    return this.persistence;
  }

  /**
   * Check if using infinite persistence
   */
  public isInfinitePersistence(): boolean {
    return this.persistence === 0;
  }
}