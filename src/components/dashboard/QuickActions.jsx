
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Search } from "lucide-react";

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => navigate(createPageUrl("AddItem"))}
        className="flex-grow sm:flex-grow-0"
        style={{
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-content)',
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Item
      </Button>
      <Button
        variant="outline"
        onClick={() => navigate(createPageUrl("Search"))}
        className="flex-grow sm:flex-grow-0"
        style={{
          borderColor: 'var(--base-300)',
          color: 'var(--base-content)',
        }}
      >
        <Search className="w-4 h-4 mr-2" />
        Search
      </Button>
    </div>
  );
}
