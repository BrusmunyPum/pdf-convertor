import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { env } from '../../config/env';

export interface ConvertOptions {
  mode: 'flow' | 'exact';
  ocr: 'auto' | 'force' | 'off';
  dpi?: number;
  embedFonts?: boolean;
  password?: string | null;
}

export interface InspectResult {
  pages: number;
  encrypted: boolean;
  scannedPages: number[];
  garbledPages: number[];
  khmer: boolean;
  fonts: string[];
}

export interface ConvertResult {
  outputPath: string;
  fileName: string;
  size: number;
  pages: number;
  warnings: string[];
  quality: Record<string, unknown>;
  durationMs: number;
}

export class ConverterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Thin HTTP client for the Python converter service. */
@Injectable()
export class ConverterClient {
  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    let res: Response;
    try {
      res = await fetch(env.converterUrl + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new AppError('CONVERTER_DOWN', 'ម៉ាស៊ីនបម្លែងមិនដំណើរការ។ សូមព្យាយាមម្ដងទៀត។', HttpStatus.SERVICE_UNAVAILABLE, {
        detail: (err as Error).message,
      });
    }
    const data = (await res.json().catch(() => ({}))) as { detail?: { code?: string; message?: string } | string };
    if (!res.ok) {
      const detail = typeof data.detail === 'object' ? data.detail : { message: String(data.detail ?? res.status) };
      throw new ConverterError(detail.code ?? 'CONVERSION_FAILED', detail.message ?? 'conversion failed', res.status);
    }
    return data as T;
  }

  inspect(inputPath: string, password?: string | null) {
    return this.post<InspectResult>('/inspect', { inputPath, password }, 60_000);
  }

  convert(body: { jobId: string; inputPath: string; outputDir: string; target: string; baseName: string; options: ConvertOptions }) {
    return this.post<ConvertResult>('/convert', body, 15 * 60_000);
  }
}
