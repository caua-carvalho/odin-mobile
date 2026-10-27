import React, { memo, useMemo } from 'react'
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import MarkdownIt, { type Token } from 'markdown-it'
import { alpha, colors, fonts, radius } from '../../lib/theme'

/**
 * Hermes streams Markdown. `markdown-it` parses it into tokens and this file
 * maps those tokens to native views, keeping the HUD language of the app
 * (mono code blocks, orange markers, cyan links, compact tables).
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
})

type RenderContext = {
  cursor: boolean
  lastInlineIndex: number
}

type MarkdownMessageProps = {
  content: string
  /** Shows a caret at the end of the last text block while tokens arrive. */
  streaming?: boolean
  style?: StyleProp<ViewStyle>
}

// -----------------------------------------------------------------------------
// Token helpers
// -----------------------------------------------------------------------------

function findMatchingClose(tokens: Token[], openIndex: number, baseType: string): number {
  let depth = 0
  for (let i = openIndex; i < tokens.length; i += 1) {
    if (tokens[i].type === `${baseType}_open`) depth += 1
    else if (tokens[i].type === `${baseType}_close`) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return tokens.length - 1
}

function openLink(href: string) {
  const target = href.trim()
  if (!target) return
  if (!/^(https?:|mailto:|tel:)/i.test(target)) return
  void Linking.openURL(target).catch(() => undefined)
}

function applyTaskMarker(tokens: Token[], start: number, end: number): { checked: boolean } | null {
  for (let i = start; i < end; i += 1) {
    const token = tokens[i]
    if (token.type !== 'inline' || !token.children) continue
    const firstText = token.children.find(
      (child) => child.type === 'text' && String(child.content).trim().length > 0,
    )
    if (!firstText) return null
    const text = String(firstText.content)
    const match = /^\[([ xX])\]\s+/.exec(text)
    if (!match) return null
    firstText.content = text.slice(match[0].length)
    token.content = String(token.content).replace(/^\[[ xX]\]\s+/, '')
    return { checked: match[1].toLowerCase() === 'x' }
  }
  return null
}

function findStandaloneImage(token?: Token): { src: string; alt: string } | null {
  const children = token?.children
  if (!children) return null

  const visible = children.filter((child) => child.type !== 'text' || child.content.trim().length > 0)
  let imageToken: Token | null = null
  if (visible.length === 1 && visible[0].type === 'image') {
    imageToken = visible[0]
  } else if (
    visible.length === 3 &&
    visible[0].type === 'link_open' &&
    visible[1].type === 'image' &&
    visible[2].type === 'link_close'
  ) {
    imageToken = visible[1]
  }
  if (!imageToken) return null

  const src = imageToken.attrGet('src')
  if (!src) return null
  return { src: String(src), alt: String(imageToken.content || '') }
}

// -----------------------------------------------------------------------------
// Inline nodes
// -----------------------------------------------------------------------------

function renderInline(
  children: Token[],
  ctx: RenderContext,
  inlineTokenIndex: number,
): React.ReactNode[] {
  const nodes = renderInlineRange(children, 0, children.length, ctx, `i${inlineTokenIndex}`)
  if (ctx.cursor && inlineTokenIndex === ctx.lastInlineIndex) {
    nodes.push(
      <Text key="cursor" style={styles.cursor}>
        {' ▍'}
      </Text>,
    )
  }
  return nodes
}

function renderInlineRange(
  children: Token[],
  start: number,
  end: number,
  ctx: RenderContext,
  keyBase: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let i = start

  while (i < end) {
    const token = children[i]

    switch (token.type) {
      case 'text':
        nodes.push(String(token.content))
        break

      case 'code_inline':
        nodes.push(
          <Text key={`${keyBase}-c${i}`} style={styles.inlineCode}>
            {String(token.content)}
          </Text>,
        )
        break

      case 'softbreak':
      case 'hardbreak':
        nodes.push('\n')
        break

      case 'strong_open': {
        const close = findMatchingClose(children, i, 'strong')
        nodes.push(
          <Text key={`${keyBase}-s${i}`} style={styles.bold}>
            {renderInlineRange(children, i + 1, close, ctx, `${keyBase}-s${i}`)}
          </Text>,
        )
        i = close
        break
      }

      case 'em_open': {
        const close = findMatchingClose(children, i, 'em')
        nodes.push(
          <Text key={`${keyBase}-e${i}`} style={styles.italic}>
            {renderInlineRange(children, i + 1, close, ctx, `${keyBase}-e${i}`)}
          </Text>,
        )
        i = close
        break
      }

      case 's_open': {
        const close = findMatchingClose(children, i, 's')
        nodes.push(
          <Text key={`${keyBase}-d${i}`} style={styles.strike}>
            {renderInlineRange(children, i + 1, close, ctx, `${keyBase}-d${i}`)}
          </Text>,
        )
        i = close
        break
      }

      case 'link_open': {
        const href = String(token.attrGet('href') || '')
        const close = findMatchingClose(children, i, 'link')
        nodes.push(
          <Text
            key={`${keyBase}-l${i}`}
            style={styles.link}
            accessibilityRole="link"
            onPress={() => openLink(href)}
          >
            {renderInlineRange(children, i + 1, close, ctx, `${keyBase}-l${i}`)}
          </Text>,
        )
        i = close
        break
      }

      case 'image': {
        const src = String(token.attrGet('src') || '')
        const alt = String(token.content || 'imagem')
        nodes.push(
          <Text key={`${keyBase}-i${i}`} style={styles.link} onPress={() => openLink(src)}>
            {`[${alt}]`}
          </Text>,
        )
        break
      }

      case 'html_inline':
        // Raw HTML stays disabled; render nothing rather than native markup.
        break

      default:
        if (token.content) nodes.push(String(token.content))
        break
    }

    i += 1
  }

  return nodes
}

// -----------------------------------------------------------------------------
// Block nodes
// -----------------------------------------------------------------------------

function renderBlocks(
  tokens: Token[],
  start: number,
  end: number,
  ctx: RenderContext,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let i = start

  while (i < end) {
    const token = tokens[i]

    switch (token.type) {
      case 'heading_open': {
        const inline = tokens[i + 1]
        const level = Math.min(6, Math.max(1, Number(token.tag.slice(1)) || 1))
        nodes.push(
          <Text key={`h-${i}`} style={[styles.heading, headingStyle(level)]}>
            {inline?.children ? renderInline(inline.children, ctx, i + 1) : null}
          </Text>,
        )
        i += 3
        continue
      }

      case 'paragraph_open': {
        const inline = tokens[i + 1]
        const image = findStandaloneImage(inline)
        if (image) {
          nodes.push(
            <Image
              key={`img-${i}`}
              source={{ uri: image.src }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={image.alt || 'imagem'}
            />,
          )
        } else {
          nodes.push(
            <Text
              key={`p-${i}`}
              style={[styles.paragraph, token.hidden && styles.paragraphTight]}
            >
              {inline?.children ? renderInline(inline.children, ctx, i + 1) : null}
            </Text>,
          )
        }
        i += 3
        continue
      }

      case 'fence':
      case 'code_block': {
        const language = token.info ? String(token.info).trim().split(/\s+/)[0] : ''
        nodes.push(
          <CodeBlock
            key={`code-${i}`}
            code={String(token.content).replace(/\n$/, '')}
            language={language}
          />,
        )
        break
      }

      case 'bullet_list_open':
      case 'ordered_list_open': {
        const base = token.type === 'bullet_list_open' ? 'bullet_list' : 'ordered_list'
        const close = findMatchingClose(tokens, i, base)
        nodes.push(
          <ListBlock
            key={`list-${i}`}
            tokens={tokens}
            start={i + 1}
            end={close}
            ordered={token.type === 'ordered_list_open'}
            startAt={Number(token.attrGet('start') || 1)}
            ctx={ctx}
          />,
        )
        i = close + 1
        continue
      }

      case 'blockquote_open': {
        const close = findMatchingClose(tokens, i, 'blockquote')
        nodes.push(
          <View key={`quote-${i}`} style={styles.blockquote}>
            {renderBlocks(tokens, i + 1, close, ctx)}
          </View>,
        )
        i = close + 1
        continue
      }

      case 'table_open': {
        const close = findMatchingClose(tokens, i, 'table')
        nodes.push(
          <TableBlock key={`table-${i}`} tokens={tokens} start={i + 1} end={close} ctx={ctx} />,
        )
        i = close + 1
        continue
      }

      case 'hr':
        nodes.push(<View key={`hr-${i}`} style={styles.hr} />)
        break

      case 'inline':
        nodes.push(
          <Text key={`inline-${i}`} style={styles.paragraph}>
            {renderInline(token.children || [], ctx, i)}
          </Text>,
        )
        break

      default:
        break
    }

    i += 1
  }

  return nodes
}

function ListBlock({
  tokens,
  start,
  end,
  ordered,
  startAt,
  ctx,
}: {
  tokens: Token[]
  start: number
  end: number
  ordered: boolean
  startAt: number
  ctx: RenderContext
}) {
  const items: React.ReactNode[] = []
  let i = start
  let index = 0

  while (i < end) {
    if (tokens[i].type === 'list_item_open') {
      const close = findMatchingClose(tokens, i, 'list_item')
      const task = applyTaskMarker(tokens, i + 1, close)
      const marker = task ? (task.checked ? '☑' : '☐') : ordered ? `${startAt + index}.` : '•'

      items.push(
        <View key={`li-${i}`} style={styles.listItem}>
          <Text
            style={[
              styles.listMarker,
              task && styles.taskMarker,
              task?.checked && styles.taskMarkerDone,
            ]}
          >
            {marker}
          </Text>
          <View style={styles.listItemBody}>
            {renderBlocks(tokens, i + 1, close, ctx)}
          </View>
        </View>,
      )

      i = close + 1
      index += 1
      continue
    }
    i += 1
  }

  return <View style={styles.list}>{items}</View>
}

function TableBlock({
  tokens,
  start,
  end,
  ctx,
}: {
  tokens: Token[]
  start: number
  end: number
  ctx: RenderContext
}) {
  const rows: { header: boolean; cells: React.ReactNode[] }[] = []
  let row: { header: boolean; cells: React.ReactNode[] } | null = null
  let inHeader = false
  let i = start

  while (i < end) {
    const token = tokens[i]

    if (token.type === 'thead_open') inHeader = true
    else if (token.type === 'thead_close') inHeader = false
    else if (token.type === 'tr_open') row = { header: inHeader, cells: [] }
    else if (token.type === 'tr_close') {
      if (row) rows.push(row)
      row = null
    } else if ((token.type === 'th_open' || token.type === 'td_open') && row) {
      const inline = tokens[i + 1]
      const align = /text-align:\s*(left|center|right)/.exec(
        String(token.attrGet('style') || ''),
      )?.[1]
      row.cells.push(
        <View
          key={`cell-${i}`}
          style={[styles.tableCell, token.type === 'th_open' && styles.tableCellHeader]}
        >
          <Text
            style={[
              styles.tableText,
              token.type === 'th_open' && styles.tableTextHeader,
              align ? { textAlign: align as TextStyle['textAlign'] } : null,
            ]}
          >
            {inline?.children ? renderInline(inline.children, ctx, i + 1) : null}
          </Text>
        </View>,
      )
    }

    i += 1
  }

  if (rows.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tableScroll}
      contentContainerStyle={styles.tableScrollContent}
    >
      <View style={styles.table}>
        {rows.map((tableRow, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[styles.tableRow, tableRow.header && styles.tableHeaderRow]}
          >
            {tableRow.cells}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLanguage}>{language || 'código'}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.codeScroll}
        contentContainerStyle={styles.codeScrollContent}
      >
        <Text style={styles.codeText} selectable>
          {code}
        </Text>
      </ScrollView>
    </View>
  )
}

function headingStyle(level: number): TextStyle {
  switch (level) {
    case 1:
      return styles.h1
    case 2:
      return styles.h2
    case 3:
      return styles.h3
    case 4:
      return styles.h4
    case 5:
      return styles.h5
    default:
      return styles.h6
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function MarkdownMessageInner({ content, streaming = false, style }: MarkdownMessageProps) {
  const nodes = useMemo(() => {
    if (!content.trim()) return null

    let tokens: Token[]
    try {
      tokens = md.parse(content, {})
    } catch {
      return <Text style={styles.paragraph}>{content}</Text>
    }

    let lastInlineIndex = -1
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].type === 'inline') lastInlineIndex = i
    }

    const ctx: RenderContext = { cursor: streaming, lastInlineIndex }
    const rendered = renderBlocks(tokens, 0, tokens.length, ctx)

    if (streaming && lastInlineIndex < 0) {
      rendered.push(
        <Text key="cursor" style={styles.cursor}>
          ▍
        </Text>,
      )
    }

    return rendered
  }, [content, streaming])

  if (!nodes) return null
  return <View style={[styles.root, style]}>{nodes}</View>
}

export const MarkdownMessage = memo(MarkdownMessageInner)

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSoft,
    marginVertical: 3,
  },
  paragraphTight: {
    marginVertical: 0,
  },
  heading: {
    color: colors.text,
    marginTop: 9,
    marginBottom: 3,
  },
  h1: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  h4: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  h5: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  h6: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  bold: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  italic: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
    color: colors.dim,
  },
  link: {
    color: colors.cyan,
    textDecorationLine: 'underline',
  },
  inlineCode: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.primaryLight,
    backgroundColor: alpha(colors.elevated, 0.95),
  },
  list: {
    marginVertical: 3,
    gap: 3,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  listMarker: {
    minWidth: 16,
    textAlign: 'right',
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    lineHeight: 21,
    color: colors.primaryLight,
  },
  taskMarker: {
    minWidth: 20,
    textAlign: 'left',
    fontSize: 14,
  },
  taskMarkerDone: {
    color: colors.successLight,
  },
  listItemBody: {
    flex: 1,
    minWidth: 0,
  },
  blockquote: {
    marginVertical: 6,
    borderLeftWidth: 2,
    borderLeftColor: alpha(colors.primary, 0.6),
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    backgroundColor: alpha(colors.elevated, 0.4),
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderBright,
    marginVertical: 10,
  },
  codeBlock: {
    alignSelf: 'stretch',
    marginVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.bg, 0.75),
    overflow: 'hidden',
  },
  codeHeader: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.8),
  },
  codeLanguage: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  codeScroll: {
    alignSelf: 'stretch',
  },
  codeScrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  codeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSoft,
  },
  image: {
    width: '100%',
    height: 180,
    marginVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.elevated,
  },
  tableScroll: {
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  tableScrollContent: {
    paddingRight: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tableHeaderRow: {
    backgroundColor: alpha(colors.elevated, 0.8),
  },
  tableCell: {
    minWidth: 120,
    maxWidth: 240,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  tableCellHeader: {
    backgroundColor: alpha(colors.elevated, 0.85),
  },
  tableText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSoft,
  },
  tableTextHeader: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  cursor: {
    fontFamily: fonts.mono,
    color: colors.primaryLight,
  },
})
