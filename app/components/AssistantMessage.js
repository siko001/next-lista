"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

function safeLink(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function inline(text) {
  const pieces = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]+)/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > offset) pieces.push(text.slice(offset, index));
    const raw = match[2] || match[3];
    const href = safeLink(raw?.replace(/[.,!?]+$/, ""));
    if (href) {
      pieces.push(<a key={index} href={href} target="_blank" rel="noopener noreferrer" className="ai-chat-link">{match[1] || new URL(href).hostname} <ExternalLink size={12} className="inline" /></a>);
    } else {
      pieces.push(match[0]);
    }
    offset = index + match[0].length;
  }
  if (offset < text.length) pieces.push(text.slice(offset));
  return pieces.map((piece, index) => {
    if (typeof piece !== "string") return piece;
    return piece.split(/(\*\*[^*]+\*\*|\`[^\`]+\`)/g).map((part, subIndex) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${index}-${subIndex}`}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={`${index}-${subIndex}`}>{part.slice(1, -1)}</code>;
      return part;
    });
  });
}

function formattedText(text) {
  const blocks = [];
  let list = [];
  let listType = null;
  const flush = () => {
    if (list.length) {
      const items = list.map((line, i) => <li key={i}>{inline(line)}</li>);
      blocks.push(listType === "ordered"
        ? <ol key={blocks.length} className="list-decimal pl-5 space-y-1">{items}</ol>
        : <ul key={blocks.length} className="list-disc pl-5 space-y-1">{items}</ul>);
    }
    list = [];
    listType = null;
  };
  for (const line of String(text || "").split("\n")) {
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const type = ordered ? "ordered" : "unordered";
      if (listType && listType !== type) flush();
      listType = type;
      list.push((ordered || unordered)[1]);
      continue;
    }
    flush();
    const heading = line.match(/^\s*#{1,3}\s+(.+)$/);
    if (heading) blocks.push(<h3 key={blocks.length} className="font-bold">{inline(heading[1])}</h3>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return blocks;
}

function LinkPreview({ url }) {
  const [preview, setPreview] = useState(null);
  const href = safeLink(url);
  useEffect(() => {
    if (!href) return;
    const controller = new AbortController();
    fetch(`/api/ai/link-preview?url=${encodeURIComponent(href)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setPreview(data))
      .catch(() => {});
    return () => controller.abort();
  }, [href]);
  if (!href) return null;
  const host = new URL(href).hostname;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="ai-chat-preview">
      <span className="ai-chat-preview-site">{preview?.site || host} <ExternalLink size={12} /></span>
      <strong>{preview?.title || host}</strong>
      {preview?.description && <span className="ai-chat-preview-description">{preview.description}</span>}
    </a>
  );
}

export default function AssistantMessage({ message, onSuggestion, onMoreIdeas }) {
  const recipe = message?.recipe;
  const recommendationList = useMemo(() => {
    const suggestions = message?.suggestions || [];
    if (recipe || suggestions.length < 2) return null;
    const copy = String(message?.text || "");
    const first = copy.search(/(?:^|\s)1[.)]\s/);
    const second = copy.search(/(?:^|\s)2[.)]\s/);
    if (first < 0 || second < 0) return null;
    const intro = copy.slice(0, first).trim();
    const last = suggestions[suggestions.length - 1];
    const end = copy.toLocaleLowerCase().lastIndexOf(last.toLocaleLowerCase());
    const outro = end >= 0 ? copy.slice(end + last.length).replace(/^[\s.:-]+/, "").trim() : "";
    return {intro, outro};
  }, [message, recipe]);
  const links = useMemo(() => {
    const textLinks = [...String(message?.text || "").matchAll(/https?:\/\/[^\s<>]+/g)]
      .map((match) => match[0].replace(/[.,!?)]+$/, ""));
    return [...new Set([...(message?.links || []), ...textLinks].filter(safeLink))].slice(0, 2);
  }, [message]);
  return (
    <div className="space-y-3">
      {recommendationList ? (
        <>
          {formattedText(recommendationList.intro)}
          <ol className="list-decimal space-y-3 pl-6">
            {message.suggestions.map((suggestion, i) => (
              <li key={i} className="pl-1">
                <button type="button" className="ai-chat-suggestion text-left" onClick={() => onSuggestion(suggestion)}>{suggestion}</button>
              </li>
            ))}
          </ol>
          {recommendationList.outro && formattedText(recommendationList.outro)}
          <button type="button" className="ai-chat-suggestion" onClick={onMoreIdeas}>More ideas</button>
        </>
      ) : formattedText(message?.text)}
      {recipe && (
        <div className="ai-chat-recipe">
          <h3>{recipe.title}</h3>
          <h4>Shopping ingredients</h4>
          <ul className="list-disc pl-5 space-y-1">
            {recipe.ingredients?.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          {!!recipe.steps?.length && (
            <>
              <h4>How to make it</h4>
              <ol className="list-decimal pl-5 space-y-2">
                {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </>
          )}
        </div>
      )}
      {links.map((url) => <LinkPreview key={url} url={url} />)}
      {!recommendationList && !!message?.suggestions?.length && (
        <div className="flex flex-wrap gap-2">
          {message.suggestions.map((suggestion, i) => (
            <button key={i} type="button" className="ai-chat-suggestion" onClick={() => onSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
          {!recipe && <button type="button" className="ai-chat-suggestion" onClick={onMoreIdeas}>More ideas</button>}
        </div>
      )}
    </div>
  );
}
