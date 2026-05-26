"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, MouseEvent, useMemo, useRef, useState } from "react";
import type ReactPlayerType from "react-player";
import { Download, Grip, Link2, ListPlus, Move, Plus, Trash2, Type, Upload } from "lucide-react";

const ReactPlayer = dynamic(() => import("react-player/youtube"), { ssr: false });

type InteractionType =
  | "text"
  | "multiple-choice"
  | "image"
  | "link"
  | "fill-blank"
  | "jump-to-time"
  | "bookmark";

interface Positioning {
  x: number;
  y: number;
  width: number;
  height: number;
  pause: boolean;
}

interface Interaction {
  id: string;
  time: number;
  type: InteractionType;
  content: Record<string, unknown>;
  positioning: Positioning;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const interactionTypes: Array<{ value: InteractionType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "multiple-choice", label: "Multiple choice" },
  { value: "image", label: "Image" },
  { value: "link", label: "Link" },
  { value: "fill-blank", label: "Fill blank" },
  { value: "jump-to-time", label: "Jump" },
  { value: "bookmark", label: "Bookmark" }
];

export default function Home() {
  const playerRef = useRef<ReactPlayerType | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [title, setTitle] = useState("Interactive Video");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedType, setSelectedType] = useState<InteractionType>("text");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const selectedInteraction = useMemo(
    () => interactions.find((item) => item.id === selectedId) ?? interactions[0],
    [interactions, selectedId]
  );

  const sortedInteractions = useMemo(
    () => interactions.slice().sort((a, b) => a.time - b.time),
    [interactions]
  );

  function addInteraction() {
    const next = createInteraction(selectedType, currentTime);
    setInteractions((items) => [...items, next]);
    setSelectedId(next.id);
  }

  function updateInteraction(id: string, patch: Partial<Interaction>) {
    setInteractions((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function updateContent(id: string, key: string, value: unknown) {
    setInteractions((items) =>
      items.map((item) =>
        item.id === id ? { ...item, content: { ...item.content, [key]: value } } : item
      )
    );
  }

  function updatePosition(id: string, patch: Partial<Positioning>) {
    setInteractions((items) =>
      items.map((item) =>
        item.id === id ? { ...item, positioning: { ...item.positioning, ...patch } } : item
      )
    );
  }

  function removeInteraction(id: string) {
    setInteractions((items) => items.filter((item) => item.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  }

  function handleTimelineChange(event: ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    setCurrentTime(nextTime);
    playerRef.current?.seekTo(nextTime, "seconds");
  }

  function handleDrag(id: string, event: MouseEvent<HTMLButtonElement>) {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    updatePosition(id, {
      x: clamp(Math.round(x), 0, 95),
      y: clamp(Math.round(y), 0, 95)
    });
  }

  async function generateH5P() {
    setError("");
    setDownloadUrl("");
    setIsGenerating(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/generate-h5p`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl, title, interactions })
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        const payload = contentType.includes("application/json")
          ? ((await response.json()) as { error?: string })
          : { error: "Generation failed" };
        throw new Error(payload.error ?? "Generation failed");
      }

      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as { downloadUrl?: string };
        if (!payload.downloadUrl) throw new Error("Generation failed");
        setDownloadUrl(payload.downloadUrl);
        window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-") || "interactive-video"}.h5p`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloadUrl(objectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to generate H5P");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">H5P Interactive Video Generator</h1>
            <p className="mt-1 text-sm text-slate-600">YouTube to timed H5P interactions</p>
          </div>
          <button
            type="button"
            onClick={generateH5P}
            disabled={isGenerating || !youtubeUrl || !title}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b685c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={18} aria-hidden="true" />
            {isGenerating ? "Generating" : "Generate H5P"}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-5">
          <div className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-soft md:grid-cols-[minmax(0,1fr)_260px]">
            <label className="text-sm font-medium text-ink">
              YouTube URL
              <input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="text-sm font-medium text-ink">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <div ref={stageRef} className="relative aspect-video overflow-hidden rounded-md bg-ink">
              <ReactPlayer
                ref={playerRef}
                url={youtubeUrl}
                controls
                width="100%"
                height="100%"
                onDuration={setDuration}
                onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
              />
              {interactions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => handleDrag(item.id, event)}
                  onClick={() => setSelectedId(item.id)}
                  title="Move interaction"
                  className={`absolute flex items-center justify-center rounded-md border-2 bg-white/90 text-ink shadow-sm transition ${
                    selectedInteraction?.id === item.id ? "border-coral" : "border-brand"
                  }`}
                  style={{
                    left: `${item.positioning.x}%`,
                    top: `${item.positioning.y}%`,
                    width: `${item.positioning.width}%`,
                    height: `${item.positioning.height}%`
                  }}
                >
                  <Move size={18} aria-hidden="true" />
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 1)}
                  value={Math.min(currentTime, Math.max(duration, 1))}
                  onChange={handleTimelineChange}
                  className="w-full accent-brand"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-600">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value as InteractionType)}
                  className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
                >
                  {interactionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addInteraction}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  <Plus size={18} aria-hidden="true" />
                  Add Interaction
                </button>
              </div>
            </div>
          </div>

          {downloadUrl && (
            <a
              href={downloadUrl}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-brand bg-white px-4 text-sm font-semibold text-brand"
            >
              <Download size={18} aria-hidden="true" />
              Download generated H5P
            </a>
          )}
          {error && <p className="rounded-md border border-coral bg-white p-3 text-sm text-coral">{error}</p>}
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-line bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-line p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Interactions</h2>
              <ListPlus size={18} className="text-slate-500" aria-hidden="true" />
            </div>
            <div className="max-h-[360px] overflow-auto p-2">
              {sortedInteractions.length === 0 ? (
                <p className="p-3 text-sm text-slate-600">No interactions yet.</p>
              ) : (
                sortedInteractions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`mb-2 flex w-full items-center gap-3 rounded-md border p-3 text-left text-sm transition ${
                      selectedInteraction?.id === item.id
                        ? "border-brand bg-[#edf8f6]"
                        : "border-line bg-white hover:bg-panel"
                    }`}
                  >
                    <Grip size={17} className="text-slate-500" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{typeLabel(item.type)}</span>
                      <span className="block text-xs text-slate-600">{formatTime(item.time)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
            {selectedInteraction ? (
              <InteractionEditor
                interaction={selectedInteraction}
                onUpdate={updateInteraction}
                onUpdateContent={updateContent}
                onUpdatePosition={updatePosition}
                onRemove={removeInteraction}
              />
            ) : (
              <div className="flex min-h-48 items-center justify-center text-center text-sm text-slate-600">
                Select or add an interaction.
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function InteractionEditor({
  interaction,
  onUpdate,
  onUpdateContent,
  onUpdatePosition,
  onRemove
}: {
  interaction: Interaction;
  onUpdate: (id: string, patch: Partial<Interaction>) => void;
  onUpdateContent: (id: string, key: string, value: unknown) => void;
  onUpdatePosition: (id: string, patch: Partial<Positioning>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {interaction.type === "link" ? <Link2 size={18} /> : <Type size={18} />}
          <h2 className="font-semibold text-ink">{typeLabel(interaction.type)}</h2>
        </div>
        <button
          type="button"
          onClick={() => onRemove(interaction.id)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-coral hover:bg-panel"
          title="Delete"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>

      <label className="block text-sm font-medium text-ink">
        Time
        <input
          type="number"
          min={0}
          value={round(interaction.time)}
          onChange={(event) => onUpdate(interaction.id, { time: Number(event.target.value) })}
          className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand"
        />
      </label>

      <ContentFields interaction={interaction} onUpdateContent={onUpdateContent} />

      <div className="grid grid-cols-2 gap-3">
        {(["x", "y", "width", "height"] as const).map((key) => (
          <label key={key} className="text-sm font-medium capitalize text-ink">
            {key}
            <input
              type="number"
              min={key === "width" || key === "height" ? 1 : 0}
              max={100}
              value={interaction.positioning[key]}
              onChange={(event) => onUpdatePosition(interaction.id, { [key]: Number(event.target.value) })}
              className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand"
            />
          </label>
        ))}
      </div>

      <label className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm font-medium text-ink">
        Pause video
        <input
          type="checkbox"
          checked={interaction.positioning.pause}
          onChange={(event) => onUpdatePosition(interaction.id, { pause: event.target.checked })}
          className="h-4 w-4 accent-brand"
        />
      </label>
    </div>
  );
}

function ContentFields({
  interaction,
  onUpdateContent
}: {
  interaction: Interaction;
  onUpdateContent: (id: string, key: string, value: unknown) => void;
}) {
  const content = interaction.content;

  if (interaction.type === "multiple-choice") {
    const options = ((content.options as string[]) ?? ["", ""]).slice(0, 4);
    return (
      <div className="space-y-3">
        <TextInput label="Question" value={String(content.question ?? "")} onChange={(value) => onUpdateContent(interaction.id, "question", value)} />
        {options.map((option, index) => (
          <TextInput
            key={index}
            label={`Option ${index + 1}`}
            value={option}
            onChange={(value) => {
              const next = [...options];
              next[index] = value;
              onUpdateContent(interaction.id, "options", next);
            }}
          />
        ))}
        <label className="block text-sm font-medium text-ink">
          Correct option
          <select
            value={Number(content.correctIndex ?? 0)}
            onChange={(event) => onUpdateContent(interaction.id, "correctIndex", Number(event.target.value))}
            className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          >
            {options.map((_option, index) => (
              <option key={index} value={index}>
                Option {index + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (interaction.type === "image") {
    return (
      <div className="space-y-3">
        <TextInput label="Image URL" value={String(content.url ?? "")} onChange={(value) => onUpdateContent(interaction.id, "url", value)} />
        <TextInput label="Alt text" value={String(content.alt ?? "")} onChange={(value) => onUpdateContent(interaction.id, "alt", value)} />
      </div>
    );
  }

  if (interaction.type === "link") {
    return (
      <div className="space-y-3">
        <TextInput label="Label" value={String(content.label ?? "")} onChange={(value) => onUpdateContent(interaction.id, "label", value)} />
        <TextInput label="URL" value={String(content.url ?? "")} onChange={(value) => onUpdateContent(interaction.id, "url", value)} />
      </div>
    );
  }

  if (interaction.type === "jump-to-time") {
    return (
      <div className="space-y-3">
        <TextInput label="Label" value={String(content.label ?? "")} onChange={(value) => onUpdateContent(interaction.id, "label", value)} />
        <TextInput
          label="Target time"
          type="number"
          value={String(content.targetTime ?? 0)}
          onChange={(value) => onUpdateContent(interaction.id, "targetTime", Number(value))}
        />
      </div>
    );
  }

  if (interaction.type === "bookmark") {
    return <TextInput label="Bookmark label" value={String(content.label ?? "")} onChange={(value) => onUpdateContent(interaction.id, "label", value)} />;
  }

  const key = interaction.type === "fill-blank" ? "text" : "text";
  return <TextArea label={interaction.type === "fill-blank" ? "Blank text" : "Text"} value={String(content[key] ?? "")} onChange={(value) => onUpdateContent(interaction.id, key, value)} />;
}

function TextInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full resize-none rounded-md border border-line p-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}

function createInteraction(type: InteractionType, time: number): Interaction {
  return {
    id: uuidv4(),
    time: round(time),
    type,
    content: defaultContent(type),
    positioning: {
      x: 12,
      y: 14,
      width: 26,
      height: 16,
      pause: true
    }
  };
}

function uuidv4() {
  return crypto.randomUUID();
}

function defaultContent(type: InteractionType): Record<string, unknown> {
  switch (type) {
    case "multiple-choice":
      return {
        question: "Choose the correct answer",
        options: ["Answer A", "Answer B"],
        correctIndex: 0
      };
    case "image":
      return { url: "https://placehold.co/640x360", alt: "Interaction image" };
    case "link":
      return { label: "Open resource", url: "https://example.com" };
    case "fill-blank":
      return { text: "H5P is an *interactive* content format." };
    case "jump-to-time":
      return { label: "Jump ahead", targetTime: 30 };
    case "bookmark":
      return { label: "Important moment" };
    default:
      return { text: "Helpful context for this moment." };
  }
}

function typeLabel(type: InteractionType) {
  return interactionTypes.find((item) => item.value === type)?.label ?? type;
}

function formatTime(value: number) {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
