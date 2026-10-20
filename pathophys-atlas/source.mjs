// Import the supplied atlas without publishing the private lessons or diagrams.
import { parse } from '@babel/parser';
import vm from 'node:vm';

export const DEMO = ['disease', 'pathogenesis'];
export function analyze(source, evaluate = true) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const declarations = new Map(), imports = [], bindings = [];
  for (const item of ast.program.body) {
    if (item.type === 'ImportDeclaration') {
      imports.push(source.slice(item.start, item.end));
      bindings.push(...item.specifiers.map(s => s.local.name));
      continue;
    }
    const node = item.type === 'ExportDefaultDeclaration' ? item.declaration : item;
    const name = node.type === 'FunctionDeclaration' ? node.id.name : node.type === 'VariableDeclaration' ? node.declarations[0].id.name : null;
    if (name) declarations.set(name, { node, text: source.slice(node.start, node.end) });
  }
  function identifiers(node) {
    const names = new Set();
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (value.type === 'Identifier' || value.type === 'JSXIdentifier') names.add(value.name);
      for (const [key, child] of Object.entries(value)) {
        if (['loc', 'start', 'end', 'extra', 'comments'].includes(key)) continue;
        if (Array.isArray(child)) child.forEach(walk); else walk(child);
      }
    }
    walk(node); return names;
  }
  function closure(seeds, excluded = new Set()) {
    const selected = new Set();
    function add(name) {
      if (selected.has(name) || excluded.has(name) || !declarations.has(name)) return;
      selected.add(name);
      for (const dependency of identifiers(declarations.get(name).node)) add(dependency);
    }
    seeds.forEach(add);
    return [...declarations].filter(([name]) => selected.has(name)).map(([name, entry]) => ({ name, ...entry }));
  }
  const dataNodes = closure(evaluate ? ['TOPICS'] : ['T_DISEASE', 'T_PATHOGEN']);
  const topics = vm.runInNewContext(dataNodes.map(entry => entry.text).join('\n') + ';JSON.stringify(' + (evaluate ? 'TOPICS' : '[T_DISEASE,T_PATHOGEN]') + ')', {}, { timeout: 5000 });
  const visuals = new Map(declarations.get('VISUALS').node.declarations[0].init.properties.map(p => [p.key.name || p.key.value, { text: source.slice(p.value.start, p.value.end), names: identifiers(p.value) }]));
  return { declarations, imports, bindings, closure, topics: JSON.parse(topics), visuals };
}
