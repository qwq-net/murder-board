import { describe, expect, it } from 'vitest';
import type { Session } from '@/types/board';
import { parseImport, serializeExport } from '../exportImport';

function fixture(): Session {
  return {
    id: 's1',
    name: 'テストセッション',
    createdAt: 1,
    updatedAt: 2,
    nodes: [
      { id: 'n1', type: 'sticky', position: { x: 0, y: 0 }, data: { text: 'あ', color: 'pink' } },
      { id: 'n2', type: 'sticky', position: { x: 100, y: 50 }, data: { text: 'い', color: 'blue' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: '関係' }],
  };
}

describe('parseImport', () => {
  it('roundtrip: 全 ID を再採番しつつ構造を保つ', () => {
    const imported = parseImport(serializeExport(fixture()), 123);
    expect(imported.name).toBe('テストセッション');
    expect(imported.id).not.toBe('s1');
    expect(imported.createdAt).toBe(123);
    expect(imported.updatedAt).toBe(123);

    expect(imported.nodes).toHaveLength(2);
    const ids = imported.nodes.map((n) => n.id);
    expect(ids).not.toContain('n1');
    expect(imported.nodes[0]!.data).toEqual({ text: 'あ', color: 'pink' });
    expect(imported.nodes[1]!.position).toEqual({ x: 100, y: 50 });

    expect(imported.edges).toHaveLength(1);
    const edge = imported.edges[0]!;
    expect(edge.id).not.toBe('e1');
    expect(ids).toContain(edge.source);
    expect(ids).toContain(edge.target);
    expect(edge.label).toBe('関係');
  });

  it('存在しないノードを参照する edge は捨てる', () => {
    const s = fixture();
    s.edges.push({ id: 'e2', source: 'n1', target: 'ghost' });
    const imported = parseImport(serializeExport(s));
    expect(imported.edges).toHaveLength(1);
  });

  it('未知の色は yellow に落とす', () => {
    const json = serializeExport(fixture()).replace('"pink"', '"neon"');
    const imported = parseImport(json);
    expect(imported.nodes[0]!.data.color).toBe('yellow');
  });

  it('壊れた JSON は throw する', () => {
    expect(() => parseImport('{oops')).toThrow('JSON');
  });

  it('別アプリのファイルは throw する', () => {
    expect(() => parseImport(JSON.stringify({ app: 'other', version: 1, session: {} }))).toThrow(
      'エクスポートファイル',
    );
  });

  it('ノードの必須フィールド欠落は throw する', () => {
    const broken = { app: 'murder-memo2', version: 1, session: { name: 'x', nodes: [{ id: 1 }], edges: [] } };
    expect(() => parseImport(JSON.stringify(broken))).toThrow('ノード');
  });
});
