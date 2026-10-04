// PHASE1-POCKET
import type { LocalLLM, LLMStats } from './types';
import { allowHosts, clearAllowedHosts } from '../utils/networkGuard';

/**
 * Optional in-browser LLM via WebGPU (MLC web-llm). Loaded lazily, only with ?llm=webllm.
 * The model weights are downloaded ONCE from the MLC/HuggingFace CDN after the user taps "Download model";
 * afterwards they come from the browser cache and inference needs no network. There is no cloud inference
 * and no silent fallback to a cloud API: if WebGPU is missing the backend reports itself unavailable.
 */
export const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export class WebLLMBackend implements LocalLLM {
  readonly name: string;
  readonly backend = 'webllm' as const;
  private engine: any = null;
  private last: LLMStats = {};
  progress = 0;

  constructor(private modelId: string = DEFAULT_MODEL_ID, private onProgress?: (p: number, text: string) => void) {
    this.name = `webllm:${modelId}`;
  }

  async isAvailable(): Promise<boolean> {
    return typeof navigator !== 'undefined' && !!(navigator as any).gpu;
  }

  /** User-initiated: allow-lists the weight hosts for the duration of the download only. */
  async load(): Promise<void> {
    if (this.engine) return;
    if (!(await this.isAvailable())) throw new Error('WEBGPU_UNAVAILABLE');
    allowHosts(['huggingface.co', 'cdn-lfs.huggingface.co', 'cdn-lfs-us-1.hf.co', 'raw.githubusercontent.com']);
    try {
      const webllm = await import('@mlc-ai/web-llm');
      this.engine = await webllm.CreateMLCEngine(this.modelId, {
        initProgressCallback: (r: any) => {
          this.progress = r.progress ?? 0;
          this.onProgress?.(this.progress, r.text ?? '');
        },
      });
    } finally {
      clearAllowedHosts();
    }
  }

  stats(): LLMStats {
    return this.last;
  }

  async generate(prompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<string> {
    if (!this.engine) await this.load();
    const t0 = performance.now();
    let ttft: number | undefined;
    let text = '';
    let tokens = 0;
    const stream = await this.engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: opts?.maxTokens ?? 512,
      temperature: opts?.temperature ?? 0.1,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        if (ttft === undefined) ttft = performance.now() - t0;
        text += delta;
        tokens += 1;
      }
    }
    const total = performance.now() - t0;
    this.last = {
      ttftMs: ttft,
      totalMs: total,
      outputTokens: tokens,
      tokensPerSec: ttft !== undefined && total > ttft ? tokens / ((total - ttft) / 1000) : undefined,
    };
    return text;
  }
}
