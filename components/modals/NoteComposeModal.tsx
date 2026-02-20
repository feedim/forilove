"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, ImagePlus } from "lucide-react";
import Modal from "./Modal";
import { NOTE_MAX_LENGTH, NOTE_MAX_TAGS, NOTE_MAX_IMAGES } from "@/lib/constants";
import { useUser } from "@/components/UserContext";
import { feedimAlert } from "@/components/FeedimAlert";
import { compressImage } from "@/lib/imageCompression";

interface NoteComposeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (note: any) => void;
}

interface TagSuggestion {
  id: number;
  name: string;
  slug: string;
  post_count?: number;
}

export default function NoteComposeModal({ open, onClose, onSuccess }: NoteComposeModalProps) {
  const { user } = useUser();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hashtag autocomplete state
  const [tagQuery, setTagQuery] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([]);
  const [tagIndex, setTagIndex] = useState(0);
  const [hashPos, setHashPos] = useState(-1);
  const tagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setContent("");
      setImages([]);
      setTagSuggestions([]);
      setTagQuery("");
      setHashPos(-1);
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, [open]);

  const remaining = NOTE_MAX_LENGTH - content.length;
  const canSubmit = content.trim().length > 0 && content.trim().length <= NOTE_MAX_LENGTH && !submitting && !uploading;

  // Extract hashtags from content
  const extractTags = (text: string): string[] => {
    const matches = text.match(/#([\p{L}\p{N}_]{2,50})/gu);
    if (!matches) return [];
    const unique = new Set(matches.map(m => m.slice(1)));
    return Array.from(unique).slice(0, NOTE_MAX_TAGS);
  };

  // — Hashtag autocomplete —
  const searchTags = useCallback(async (query: string) => {
    if (query.length < 1) { setTagSuggestions([]); return; }
    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}&limit=6`);
      const data = await res.json();
      setTagSuggestions(data.tags || []);
      setTagIndex(0);
    } catch { setTagSuggestions([]); }
  }, []);

  const handleContentChange = (value: string) => {
    setContent(value);
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Detect hashtag being typed: # followed by word chars at the end
    const hashMatch = textBeforeCursor.match(/(^|[\s])#([\p{L}\p{N}_]*)$/u);
    if (hashMatch) {
      const query = hashMatch[2];
      setHashPos(cursorPos - query.length - 1); // position of #
      setTagQuery(query);
      if (tagTimerRef.current) clearTimeout(tagTimerRef.current);
      if (query.length >= 1) {
        tagTimerRef.current = setTimeout(() => searchTags(query), 250);
      } else {
        setTagSuggestions([]);
      }
    } else {
      setTagSuggestions([]);
      setTagQuery("");
      setHashPos(-1);
    }
  };

  const selectTag = (tagName: string) => {
    if (hashPos < 0) return;
    // Replace from # to current cursor with the selected tag
    const before = content.substring(0, hashPos);
    const after = content.substring(hashPos + 1 + tagQuery.length);
    const newValue = before + "#" + tagName + " " + after;
    setContent(newValue);
    setTagSuggestions([]);
    setTagQuery("");
    setHashPos(-1);
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + tagName.length + 2; // +2 for # and space
        textareaRef.current.selectionStart = pos;
        textareaRef.current.selectionEnd = pos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (tagSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setTagIndex(i => (i < tagSuggestions.length - 1 ? i + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setTagIndex(i => (i > 0 ? i - 1 : tagSuggestions.length - 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectTag(tagSuggestions[tagIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setTagSuggestions([]);
        return;
      }
    }
  };

  // — Images —
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const slotsLeft = NOTE_MAX_IMAGES - images.length;
    if (slotsLeft <= 0) {
      feedimAlert("warning", `En fazla ${NOTE_MAX_IMAGES} gorsel ekleyebilirsin.`);
      return;
    }

    const toAdd = Array.from(files).slice(0, slotsLeft);

    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) {
        feedimAlert("warning", "Sadece gorsel dosyalari yuklenebilir.");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        feedimAlert("warning", "Gorsel boyutu 10MB'dan buyuk olamaz.");
        continue;
      }

      try {
        const compressed = await compressImage(file, { maxSizeMB: 2, maxWidthOrHeight: 2048 });
        const preview = URL.createObjectURL(compressed);
        setImages(prev => [...prev, { file: compressed, preview }]);
      } catch {
        feedimAlert("error", "Gorsel sikistirilamadi.");
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const img of images) {
      const formData = new FormData();
      formData.append("file", img.file);
      formData.append("fileName", `note_${Date.now()}`);

      const res = await fetch("/api/upload/image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yukleme hatasi");
      urls.push(data.url);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        setUploading(true);
        imageUrls = await uploadImages();
        setUploading(false);
      }

      // Extract tags from content
      const tags = extractTags(content.trim());

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          tags: tags.length > 0 ? tags : undefined,
          images: imageUrls.length > 0 ? imageUrls : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        feedimAlert("error", data.error || "Not paylasilamadi.");
        return;
      }

      if (data.moderation) {
        feedimAlert("info", data.message || "Notunuz incelemeye alindi.");
      } else {
        feedimAlert("success", "Not paylasildi!");
      }

      onSuccess?.(data.note);
      onClose();
    } catch {
      feedimAlert("error", "Bir hata olustu.");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const currentTags = extractTags(content);

  const rightAction = (
    <button
      onClick={handleSubmit}
      disabled={!canSubmit}
      className="t-btn text-[0.85rem] !px-5 !py-1.5 disabled:opacity-40"
    >
      {submitting ? <span className="loader" style={{ width: 16, height: 16 }} /> : "Paylas"}
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title="Not Yaz" size="md" centerOnDesktop rightAction={rightAction}>
      <div className="px-4 py-3">
        {/* Compose area */}
        <div className="flex gap-3">
          <div className="shrink-0 pt-1">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <img className="default-avatar-auto h-10 w-10 rounded-full object-cover" alt="" />
            )}
          </div>
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Ne dusunuyorsun?"
              className="w-full bg-transparent text-[0.95rem] text-text-primary placeholder:text-text-muted/50 resize-none outline-none min-h-[120px] leading-relaxed"
              maxLength={NOTE_MAX_LENGTH + 50}
            />

            {/* Hashtag suggestion dropdown */}
            {tagSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 bg-bg-elevated border border-border-primary rounded-xl shadow-xl max-h-[200px] overflow-y-auto z-50">
                {tagSuggestions.map((tag, i) => (
                  <button
                    key={tag.id}
                    onClick={() => selectTag(tag.name)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition text-[0.88rem] ${
                      i === tagIndex ? "bg-accent-main/10" : "hover:bg-bg-tertiary"
                    }`}
                  >
                    <span className="font-medium text-text-primary">#{tag.name}</span>
                    {tag.post_count != null && tag.post_count > 0 && (
                      <span className="text-[0.72rem] text-text-muted">{tag.post_count} gonderi</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex gap-2 mt-2 mb-1 overflow-x-auto scrollbar-hide">
            {images.map((img, i) => (
              <div key={i} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-bg-secondary">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar: image picker + tag count + character counter */}
        <div className="flex items-center justify-between mt-1 border-t border-border-primary pt-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= NOTE_MAX_IMAGES || uploading}
              className="flex items-center gap-1.5 text-accent-main hover:text-accent-main/80 disabled:opacity-30 transition"
            >
              <ImagePlus className="h-[18px] w-[18px]" />
              {images.length > 0 && (
                <span className="text-[0.7rem] font-medium">{images.length}/{NOTE_MAX_IMAGES}</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Inline tag count indicator */}
            {currentTags.length > 0 && (
              <span className={`text-[0.7rem] font-medium ${currentTags.length >= NOTE_MAX_TAGS ? "text-warning" : "text-accent-main/60"}`}>
                #{currentTags.length}/{NOTE_MAX_TAGS}
              </span>
            )}
          </div>

          <span className={`text-[0.72rem] font-mono ${
            remaining < 0 ? "text-error font-bold" :
            remaining < 50 ? "text-warning" :
            "text-text-muted/50"
          }`}>
            {remaining}
          </span>
        </div>
      </div>
    </Modal>
  );
}
