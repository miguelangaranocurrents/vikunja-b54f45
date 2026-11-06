import {Extension} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import type {Fragment, Node as ProseMirrorNode, Slice} from '@tiptap/pm/model'

/*
 * Plain text for the clipboard. The default serializer flattens the document into its bare
 * text, so a copied list loses its markers and reads as unrelated lines. This keeps the
 * structure that matters for plain text: list markers, task checkboxes and quotes.
 */

function indentLines(text: string, prefix: string, rest: string = ' '.repeat(prefix.length)): string {
	return text
		.split('\n')
		.map((line, i) => (i === 0 ? prefix : rest) + line)
		.join('\n')
}

function serializeListItem(item: ProseMirrorNode, marker: string): string {
	const body = serializeBlocks(item.content, '\n')
	return indentLines(body, marker)
}

function serializeNode(node: ProseMirrorNode): string {
	switch (node.type.name) {
		case 'bulletList': {
			const items: string[] = []
			node.forEach(item => items.push(serializeListItem(item, '- ')))
			return items.join('\n')
		}
		case 'orderedList': {
			const start = typeof node.attrs.start === 'number' ? node.attrs.start : 1
			const items: string[] = []
			node.forEach((item, _offset, index) => items.push(serializeListItem(item, `${start + index}. `)))
			return items.join('\n')
		}
		case 'taskList': {
			const items: string[] = []
			node.forEach(item => items.push(serializeListItem(item, item.attrs.checked ? '- [x] ' : '- [ ] ')))
			return items.join('\n')
		}
		case 'blockquote':
			return indentLines(serializeBlocks(node.content, '\n\n'), '> ', '> ')
		default:
			break
	}

	if (node.isTextblock || node.isLeaf) {
		return node.isLeaf
			? (node.type.spec.leafText?.(node) ?? node.textContent)
			: node.textBetween(0, node.content.size, '\n')
	}

	return serializeBlocks(node.content, '\n')
}

function serializeBlocks(fragment: Fragment, separator: string): string {
	let hasBlocks = false
	fragment.forEach(child => {
		if (child.isBlock) {
			hasBlocks = true
		}
	})

	if (!hasBlocks) {
		return fragment.textBetween(0, fragment.size, '\n')
	}

	const parts: string[] = []
	fragment.forEach(child => parts.push(serializeNode(child)))
	return parts.join(separator)
}

export function serializeSliceAsText(slice: Slice): string {
	return serializeBlocks(slice.content, '\n\n')
}

export const ClipboardTextWithStructure = Extension.create({
	name: 'clipboardTextWithStructure',

	// ahead of tiptap's core clipboard text serializer, the first plugin providing the prop wins
	priority: 1000,

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('clipboardTextWithStructure'),
				props: {
					clipboardTextSerializer: slice => serializeSliceAsText(slice),
				},
			}),
		]
	},
})
