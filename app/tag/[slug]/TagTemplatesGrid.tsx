"use client";

import { Heart } from "lucide-react";
import TemplateCard from "@/components/TemplateCard";

const ITEMS_PER_PAGE = 6;

interface TagTemplatesGridProps {
  initialTemplates: any[];
}

export default function TagTemplatesGrid({ initialTemplates }: TagTemplatesGridProps) {
  const handleTemplateClick = (templateId: string) => {
    window.location.href = `/editor/${templateId}`;
  };

  if (initialTemplates.length === 0) {
    return (
      <div className="text-center py-20">
        <Heart className="h-20 w-20 text-pink-500/30 mx-auto mb-6" aria-hidden="true" />
        <p className="text-xl text-zinc-400">Bu etikete ait şablon bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {initialTemplates.map((template: any) => (
        <div key={template.id}>
          <TemplateCard
            template={template}
            isPurchased={false}
            isSaved={false}
            showSaveButton={true}
            showPrice={true}
            onClick={() => handleTemplateClick(template.id)}
            tags={(template.template_tags || []).map((tt: any) => tt.tags).filter(Boolean)}
          />
        </div>
      ))}
    </div>
  );
}
