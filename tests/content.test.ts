import { describe, expect, it } from 'vitest';
import { loadContent, ContentError } from '../src/content/load';
import { readContentFiles } from '../tools/node-content';

describe('content', () => {
  const files = readContentFiles();

  it('loads and validates every file', () => {
    expect(() => loadContent(files)).not.toThrow();
  });

  it('reports the file and field when something is wrong', () => {
    const broken = { ...files, 'content/traits/hothead.yaml': files['content/traits/hothead.yaml'].replace('rate: 1.1', 'rate: -1') };
    try { loadContent(broken); expect.unreachable(); } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      expect((e as ContentError).problems.join('\n')).toContain('content/traits/hothead.yaml: rate');
    }
  });

  it('has a Danish name, nametag and description for every trait', () => {
    const c = loadContent(files);
    for (const id of Object.keys(c.traits)) {
      expect(c.text.da[`trait.${id}.name`], id).toBeTruthy();
      expect(c.text.da[`trait.${id}.desc`], id).toBeTruthy();
      expect(c.text.da[`trait.${id}.short`], id).toBeTruthy();
    }
  });
});
