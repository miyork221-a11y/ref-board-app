"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useParams } from "next/navigation";

type ProjectItem = {
  id: string;
  project_id: string;
  image_url: string;
  note: string;
  tags: string[];
};

type Project = {
  id: string;
  name: string;
};

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError) {
      console.error(projectError);
      setLoading(false);
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("project_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (itemError) {
      console.error(itemError);
      setLoading(false);
      return;
    }

    setProject(projectData);
    setItems(itemData || []);
    setLoading(false);
  };

  const addImage = async () => {
    if (!imageUrl.trim()) {
      alert("OneDrive 이미지 링크를 입력하세요.");
      return;
    }

    const { error } = await supabase.from("project_items").insert([
      {
        project_id: projectId,
        image_url: imageUrl.trim(),
        note: "",
        tags: [],
      },
    ]);

    if (error) {
      console.error(error);
      alert("이미지 추가 실패");
      return;
    }

    setImageUrl("");
    loadProject();
  };

  if (loading) {
    return <main style={{ padding: 40, color: "white", background: "#050505", minHeight: "100vh" }}>로딩중...</main>;
  }

  if (!project) {
    return <main style={{ padding: 40, color: "white", background: "#050505", minHeight: "100vh" }}>프로젝트를 찾을 수 없습니다.</main>;
  }

  return (
    <main style={{ padding: 40, color: "white", background: "#050505", minHeight: "100vh" }}>
      <h1>{project.name}</h1>

      <div style={{ marginTop: 20 }}>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="OneDrive 이미지 링크"
          style={{ padding: 10, width: 400 }}
        />
        <button onClick={addImage} style={{ marginLeft: 10 }}>
          추가
        </button>
      </div>

      <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {items.map((item) => (
          <img
            key={item.id}
            src={item.image_url}
            style={{ width: "100%", height: 200, objectFit: "cover" }}
          />
        ))}
      </div>
    </main>
  );
}