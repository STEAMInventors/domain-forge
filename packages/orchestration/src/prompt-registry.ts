import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256Hex } from '@domain-forge/core';

export interface PromptTemplate {
  id: string;
  version: string;
  filePath: string;
  content: string;
  contentHash: string;
}

export class PromptRegistry {
  private readonly templates = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    this.templates.set(`${template.id}@${template.version}`, template);
  }

  get(id: string, version: string): PromptTemplate {
    const key = `${id}@${version}`;
    const template = this.templates.get(key);
    if (!template) {
      throw new Error(`Prompt template not found: ${key}`);
    }
    return template;
  }

  async loadFromDirectory(baseDir: string, id: string, version: string, filename: string): Promise<PromptTemplate> {
    const filePath = join(baseDir, filename);
    const content = await readFile(filePath, 'utf8');
    const template: PromptTemplate = {
      id,
      version,
      filePath,
      content,
      contentHash: sha256Hex(content),
    };
    this.register(template);
    return template;
  }

  render(template: PromptTemplate, params: Record<string, string>): { rendered: string; renderedInputHash: string } {
    let rendered = template.content;
    for (const [key, value] of Object.entries(params)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return { rendered, renderedInputHash: sha256Hex(rendered) };
  }
}
