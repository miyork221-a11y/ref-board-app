"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { supabase } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  created_at: string;
  sort_order: number | null;
};

type ProjectItem = {
  id: string;
  project_id: string;
  image_url: string;
  note: string;
  tags: string[] | null;
  created_at: string;
  reference_link: string | null;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [searchText, setSearchText] = useState("");
  const [newTag, setNewTag] = useState("");

  const [noteDraft, setNoteDraft] = useState("");
  const [referenceLinkDraft, setReferenceLinkDraft] = useState("");

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [addingImage, setAddingImage] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [copyingItem, setCopyingItem] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string>("전체");
  const [copyTargetProjectId, setCopyTargetProjectId] = useState<string>("");

  const [viewportWidth, setViewportWidth] = useState(1440);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [isSavingProjectOrder, setIsSavingProjectOrder] = useState(false);

  const isMobile = viewportWidth <= 640;
  const isSmallMobile = viewportWidth <= 430;
  const isTablet = viewportWidth > 640 && viewportWidth <= 1100;

  useEffect(() => {
    const updateWidth = () => {
      setViewportWidth(window.innerWidth);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    loadItems(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const projectIdFromQuery = url.searchParams.get("project");
    if (!projectIdFromQuery) return;
    setSelectedProjectId(projectIdFromQuery);
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      setCopyTargetProjectId("");
      return;
    }

    const current = items.find((item) => item.id === selectedItemId);
    if (current) {
      setCopyTargetProjectId(current.project_id);
    }
  }, [selectedItemId, items]);

  const getYoutubeVideoId = (url: string) => {
    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.hostname.includes("youtube.com")) {
        const videoId = parsedUrl.searchParams.get("v");
        if (videoId) return videoId;

        const shortsMatch = parsedUrl.pathname.match(/\/shorts\/([^/?]+)/);
        if (shortsMatch?.[1]) return shortsMatch[1];
      }

      if (parsedUrl.hostname.includes("youtu.be")) {
        const path = parsedUrl.pathname.replace("/", "");
        return path || null;
      }

      return null;
    } catch {
      return null;
    }
  };

  const isYoutubeUrl = (url: string) => {
    return url.includes("youtube.com") || url.includes("youtu.be");
  };

  const isYoutubeItem = (item: ProjectItem) => {
    return (
      (item.reference_link?.includes("youtube.com") ?? false) ||
      (item.reference_link?.includes("youtu.be") ?? false) ||
      (item.tags || []).includes("youtube")
    );
  };

  const loadProjects = async () => {
    setLoadingProjects(true);

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    setLoadingProjects(false);

    if (error) {
      console.error(error);
      alert(`프로젝트 목록 불러오기 실패: ${error.message}`);
      return;
    }

    const nextProjects = data || [];
    setProjects(nextProjects);

    setSelectedProjectId((prev) => {
      if (prev && nextProjects.some((p) => p.id === prev)) return prev;
      return nextProjects[0]?.id ?? null;
    });
  };

  const loadItems = async (projectId: string) => {
    const { data, error } = await supabase
      .from("project_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`이미지 목록 불러오기 실패: ${error.message}`);
      return;
    }

    setItems(data || []);
  };

  const saveProjectOrder = async (nextProjects: Project[]) => {
    setIsSavingProjectOrder(true);

    const results = await Promise.all(
      nextProjects.map((project, index) =>
        supabase
          .from("projects")
          .update({ sort_order: index + 1 })
          .eq("id", project.id)
      )
    );

    setIsSavingProjectOrder(false);

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      console.error(failed.error);
      alert(`프로젝트 순서 저장 실패: ${failed.error.message}`);
      await loadProjects();
    }
  };

  const handleProjectDrop = async (
    event: DragEvent<HTMLDivElement>,
    targetProjectId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedProjectId || draggedProjectId === targetProjectId) {
      setDraggedProjectId(null);
      setDragOverProjectId(null);
      return;
    }

    const draggedIndex = projects.findIndex((project) => project.id === draggedProjectId);
    const targetIndex = projects.findIndex((project) => project.id === targetProjectId);

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedProjectId(null);
      setDragOverProjectId(null);
      return;
    }

    const nextProjects = [...projects];
    const [draggedProject] = nextProjects.splice(draggedIndex, 1);
    nextProjects.splice(targetIndex, 0, draggedProject);

    const orderedProjects = nextProjects.map((project, index) => ({
      ...project,
      sort_order: index + 1,
    }));

    setProjects(orderedProjects);
    setDraggedProjectId(null);
    setDragOverProjectId(null);

    await saveProjectOrder(orderedProjects);
  };

  const addProject = async () => {
    if (!projectName.trim()) {
      alert("프로젝트 이름을 입력하세요.");
      return;
    }

    const maxOrder =
      projects.length > 0
        ? Math.max(...projects.map((project) => project.sort_order || 0))
        : 0;

    setCreatingProject(true);

    const { data, error } = await supabase
      .from("projects")
      .insert([{ name: projectName.trim(), sort_order: maxOrder + 1 }])
      .select()
      .single();

    setCreatingProject(false);

    if (error) {
      console.error(error);
      alert(`프로젝트 생성 실패: ${error.message}`);
      return;
    }

    setProjectName("");
    await loadProjects();

    if (data?.id) {
      setSelectedProjectId(data.id);
      setItems([]);
      setSelectedItemId(null);

      const url = new URL(window.location.href);
      url.searchParams.set("project", data.id);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const deleteProject = async (projectId: string) => {
    const ok = window.confirm("이 프로젝트를 삭제할까요?");
    if (!ok) return;

    setDeletingProjectId(projectId);
    setOpenProjectMenuId(null);

    const { error } = await supabase.from("projects").delete().eq("id", projectId);

    setDeletingProjectId(null);

    if (error) {
      console.error(error);
      alert(`프로젝트 삭제 실패: ${error.message}`);
      return;
    }

    const nextProjects = projects.filter((p) => p.id !== projectId);
    const orderedProjects = nextProjects.map((project, index) => ({
      ...project,
      sort_order: index + 1,
    }));

    setProjects(orderedProjects);

    if (orderedProjects.length > 0) {
      await saveProjectOrder(orderedProjects);
    }

    if (selectedProjectId === projectId) {
      const nextSelectedId = orderedProjects[0]?.id ?? null;
      setSelectedProjectId(nextSelectedId);
      setSelectedItemId(null);

      const url = new URL(window.location.href);
      if (nextSelectedId) {
        url.searchParams.set("project", nextSelectedId);
      } else {
        url.searchParams.delete("project");
      }
      window.history.replaceState({}, "", url.toString());

      if (nextSelectedId) {
        await loadItems(nextSelectedId);
      } else {
        setItems([]);
      }
    }

    await loadProjects();
  };

  const addImageByUrl = async () => {
    if (!selectedProjectId) {
      alert("먼저 프로젝트를 선택하세요.");
      return;
    }

    if (!imageUrl.trim()) {
      alert("이미지 또는 유튜브 링크를 입력하세요.");
      return;
    }

    const originalUrl = imageUrl.trim();
    let finalImageUrl = originalUrl;
    let finalReferenceLink = originalUrl;
    let finalTags: string[] = [];

    if (isYoutubeUrl(originalUrl)) {
      const videoId = getYoutubeVideoId(originalUrl);

      if (!videoId) {
        alert("유튜브 링크를 확인할 수 없습니다.");
        return;
      }

      finalImageUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      finalReferenceLink = originalUrl;
      finalTags = ["youtube"];
    }

    setAddingImage(true);

    const { error } = await supabase.from("project_items").insert([
      {
        project_id: selectedProjectId,
        image_url: finalImageUrl,
        note: "",
        tags: finalTags,
        reference_link: finalReferenceLink,
      },
    ]);

    setAddingImage(false);

    if (error) {
      console.error(error);
      alert(`이미지 추가 실패: ${error.message}`);
      return;
    }

    setImageUrl("");
    await loadItems(selectedProjectId);
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase.from("project_items").delete().eq("id", itemId);

    if (error) {
      console.error(error);
      alert(`이미지 삭제 실패: ${error.message}`);
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemId));
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  const updateNote = async (itemId: string, note: string) => {
    const { error } = await supabase
      .from("project_items")
      .update({ note })
      .eq("id", itemId);

    if (error) {
      console.error(error);
      alert(`메모 저장 실패: ${error.message}`);
      return;
    }

    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, note } : item))
    );
  };

  const updateReferenceLink = async (itemId: string, referenceLink: string) => {
    const { error } = await supabase
      .from("project_items")
      .update({ reference_link: referenceLink })
      .eq("id", itemId);

    if (error) {
      console.error(error);
      alert(`링크 저장 실패: ${error.message}`);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, reference_link: referenceLink } : item
      )
    );
  };

  const addTag = async () => {
    if (!selectedItemId || !newTag.trim()) return;

    const item = items.find((x) => x.id === selectedItemId);
    if (!item) return;

    const currentTags = item.tags || [];
    const value = newTag.trim();

    if (currentTags.includes(value)) {
      setNewTag("");
      return;
    }

    const nextTags = [...currentTags, value];

    const { error } = await supabase
      .from("project_items")
      .update({ tags: nextTags })
      .eq("id", selectedItemId);

    if (error) {
      console.error(error);
      alert(`태그 저장 실패: ${error.message}`);
      return;
    }

    setItems((prev) =>
      prev.map((x) => (x.id === selectedItemId ? { ...x, tags: nextTags } : x))
    );
    setNewTag("");
  };

  const removeTag = async (tagToRemove: string) => {
    if (!selectedItemId) return;

    const item = items.find((x) => x.id === selectedItemId);
    if (!item) return;

    const nextTags = (item.tags || []).filter((tag) => tag !== tagToRemove);

    const { error } = await supabase
      .from("project_items")
      .update({ tags: nextTags })
      .eq("id", selectedItemId);

    if (error) {
      console.error(error);
      alert(`태그 삭제 실패: ${error.message}`);
      return;
    }

    setItems((prev) =>
      prev.map((x) => (x.id === selectedItemId ? { ...x, tags: nextTags } : x))
    );
  };

  const copyItemToProject = async () => {
    if (!selectedItemId || !copyTargetProjectId) return;

    const currentItem = items.find((item) => item.id === selectedItemId);
    if (!currentItem) return;

    if (currentItem.project_id === copyTargetProjectId) {
      alert("같은 프로젝트에는 복사할 수 없습니다.");
      return;
    }

    setCopyingItem(true);

    const { error } = await supabase.from("project_items").insert([
      {
        project_id: copyTargetProjectId,
        image_url: currentItem.image_url,
        note: currentItem.note || "",
        tags: currentItem.tags || [],
        reference_link: currentItem.reference_link || "",
      },
    ]);

    setCopyingItem(false);

    if (error) {
      console.error(error);
      alert(`이미지 복사 실패: ${error.message}`);
      return;
    }

    alert("다른 프로젝트에 복사되었습니다.");
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const selectedItem = items.find((item) => item.id === selectedItemId) || null;

  useEffect(() => {
    if (!selectedItem) {
      setNoteDraft("");
      setReferenceLinkDraft("");
      return;
    }

    setNoteDraft(selectedItem.note || "");
    setReferenceLinkDraft(selectedItem.reference_link || "");
  }, [selectedItemId, selectedItem?.note, selectedItem?.reference_link]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => {
      (item.tags || []).forEach((tag) => tags.add(tag));
    });
    return ["전체", ...Array.from(tags)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return items.filter((item) => {
      const noteMatch = !q || (item.note || "").toLowerCase().includes(q);
      const tagSearchMatch =
        !q || (item.tags || []).some((tag) => tag.toLowerCase().includes(q));
      const textMatch = noteMatch || tagSearchMatch;

      const tagFilterMatch =
        activeTag === "전체" || (item.tags || []).includes(activeTag);

      return textMatch && tagFilterMatch;
    });
  }, [items, searchText, activeTag]);

  const toolbarGridColumns = isMobile
    ? "1fr"
    : isTablet
    ? "1fr 1fr"
    : "0.95fr 0.6fr 0.95fr 0.6fr 1.2fr";

  const imageGridColumns = isMobile
    ? "1fr"
    : isTablet
    ? "repeat(2, minmax(0, 1fr))"
    : "repeat(4, minmax(0, 1fr))";

  const projectCardWidth = isSmallMobile
    ? "100%"
    : isMobile
    ? "calc(50% - 5px)"
    : "220px";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f6f6",
        color: "#111",
        fontFamily:
          'Inter, Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
      }}
      onClick={() => setOpenProjectMenuId(null)}
    >
      <div
        style={{
          maxWidth: "1700px",
          margin: "0 auto",
          padding: isMobile ? "16px 12px 44px" : "20px 18px 60px",
        }}
      >
        <section
          style={{
            textAlign: "center",
            marginBottom: isMobile ? "18px" : "24px",
          }}
        >
          <h1
            style={{
              fontSize: isMobile ? "34px" : "48px",
              fontWeight: 900,
              margin: "0 0 8px",
              letterSpacing: "-1px",
            }}
          >
            꺼내 먹어요
          </h1>

          <p
            style={{
              fontSize: isMobile ? "15px" : "18px",
              lineHeight: 1.45,
              color: "#666",
              margin: 0,
            }}
          >
            이미지 중심으로 모아보고, 태그와 메모로 빠르게 탐색하세요
          </p>
        </section>

        <section
          style={{
            background: "white",
            borderRadius: "20px",
            border: "1px solid #e9e9e9",
            padding: isMobile ? "12px" : "14px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: toolbarGridColumns,
              gap: "10px",
              alignItems: "center",
            }}
          >
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="새 프로젝트 이름"
              style={{
                height: isMobile ? "50px" : "54px",
                borderRadius: "999px",
                border: "1px solid #e5e5e5",
                padding: "0 20px",
                fontSize: isMobile ? "14px" : "15px",
                background: "#fafafa",
                outline: "none",
                minWidth: 0,
              }}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                addProject();
              }}
              disabled={creatingProject}
              style={{
                height: isMobile ? "50px" : "54px",
                borderRadius: "999px",
                border: "1px solid #e8e8e8",
                background: "#111",
                color: "white",
                fontSize: isMobile ? "14px" : "15px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {creatingProject ? "생성 중..." : "프로젝트 만들기"}
            </button>

            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="이미지 또는 유튜브 링크"
              style={{
                height: isMobile ? "50px" : "54px",
                borderRadius: "999px",
                border: "1px solid #e5e5e5",
                padding: "0 20px",
                fontSize: isMobile ? "14px" : "15px",
                background: "#fafafa",
                outline: "none",
                minWidth: 0,
              }}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                addImageByUrl();
              }}
              disabled={!selectedProjectId || addingImage}
              style={{
                height: isMobile ? "50px" : "54px",
                borderRadius: "999px",
                border: "1px solid #f3d04b",
                background: !selectedProjectId ? "#e8e0a8" : "#ffd84d",
                color: "#111",
                fontSize: isMobile ? "14px" : "15px",
                fontWeight: 800,
                cursor: !selectedProjectId ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                boxShadow: !selectedProjectId
                  ? "none"
                  : "0 8px 20px rgba(255, 216, 77, 0.35)",
              }}
            >
              {addingImage ? "추가 중..." : "링크로 이미지 추가"}
            </button>

            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="레퍼런스 검색..."
              style={{
                height: isMobile ? "50px" : "54px",
                borderRadius: "999px",
                border: "1px solid #e5e5e5",
                padding: "0 20px",
                fontSize: isMobile ? "14px" : "16px",
                background: "#fafafa",
                outline: "none",
                minWidth: 0,
              }}
            />
          </div>
        </section>

        {isSavingProjectOrder && (
          <div
            style={{
              marginBottom: "12px",
              color: "#666",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            프로젝트 순서 저장 중...
          </div>
        )}

        <section style={{ marginBottom: "14px" }}>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            {loadingProjects ? (
              <div style={{ color: "#777", padding: "10px 0" }}>
                프로젝트 불러오는 중...
              </div>
            ) : projects.length === 0 ? (
              <div style={{ color: "#777", padding: "10px 0" }}>
                프로젝트가 없습니다.
              </div>
            ) : (
              projects.map((project) => {
                const isActive = selectedProjectId === project.id;
                const isDragging = draggedProjectId === project.id;
                const isDragOver = dragOverProjectId === project.id;

                return (
                  <div
                    key={project.id}
                    draggable={!isMobile}
                    onDragStart={(e) => {
                      if (isMobile) return;
                      setDraggedProjectId(project.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (isMobile) return;
                      e.preventDefault();
                      setDragOverProjectId(project.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverProjectId === project.id) {
                        setDragOverProjectId(null);
                      }
                    }}
                    onDrop={(e) => handleProjectDrop(e, project.id)}
                    onDragEnd={() => {
                      setDraggedProjectId(null);
                      setDragOverProjectId(null);
                    }}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setSelectedItemId(null);
                      setOpenProjectMenuId(null);
                      setActiveTag("전체");

                      const url = new URL(window.location.href);
                      url.searchParams.set("project", project.id);
                      window.history.replaceState({}, "", url.toString());
                    }}
                    title={!isMobile ? "드래그해서 순서를 바꿀 수 있습니다." : ""}
                    style={{
                      width: projectCardWidth,
                      borderRadius: "16px",
                      padding: isMobile ? "13px" : "14px 16px",
                      background: isActive ? "#111" : "white",
                      color: isActive ? "white" : "#111",
                      border: isDragOver
                        ? "2px dashed #111"
                        : isActive
                        ? "1px solid #111"
                        : "1px solid #e7e7e7",
                      cursor: isMobile ? "pointer" : "grab",
                      position: "relative",
                      boxShadow: isActive
                        ? "0 10px 24px rgba(0,0,0,0.12)"
                        : "0 4px 12px rgba(0,0,0,0.03)",
                      overflow: "visible",
                      opacity: isDragging ? 0.45 : 1,
                      transform: isDragOver ? "translateY(-2px)" : "none",
                      transition: "0.16s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: isMobile ? "15px" : "17px",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {project.name}
                        </div>

                        {!isMobile && (
                          <div
                            style={{
                              fontSize: "11px",
                              marginTop: "6px",
                              color: isActive ? "rgba(255,255,255,0.58)" : "#999",
                            }}
                          >
                            드래그로 순서 변경
                          </div>
                        )}
                      </div>

                      <div style={{ position: "relative", overflow: "visible" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenProjectMenuId((prev) =>
                              prev === project.id ? null : project.id
                            );
                          }}
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "10px",
                            border: isActive
                              ? "1px solid rgba(255,255,255,0.16)"
                              : "1px solid #ececec",
                            background: isActive ? "#1e1e1e" : "#fafafa",
                            color: isActive ? "white" : "#111",
                            cursor: "pointer",
                            fontSize: "18px",
                            fontWeight: "bold",
                          }}
                        >
                          ⋯
                        </button>

                        {openProjectMenuId === project.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              top: "42px",
                              right: 0,
                              minWidth: "140px",
                              background: "white",
                              border: "1px solid #e8e8e8",
                              borderRadius: "14px",
                              overflow: "hidden",
                              boxShadow: "0 14px 32px rgba(0,0,0,0.12)",
                              zIndex: 50,
                            }}
                          >
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${window.location.origin}?project=${project.id}`
                                );
                                alert("공유용 링크를 복사했습니다.");
                                setOpenProjectMenuId(null);
                              }}
                              style={{
                                width: "100%",
                                padding: "12px 14px",
                                border: "none",
                                borderBottom: "1px solid #f0f0f0",
                                background: "white",
                                textAlign: "left",
                                cursor: "pointer",
                                fontSize: "14px",
                                color: "#111",
                                fontWeight: 600,
                              }}
                            >
                              링크 복사
                            </button>

                            <button
                              onClick={() => {
                                deleteProject(project.id);
                              }}
                              disabled={deletingProjectId === project.id}
                              style={{
                                width: "100%",
                                padding: "12px 14px",
                                border: "none",
                                background: "white",
                                textAlign: "left",
                                cursor: "pointer",
                                fontSize: "14px",
                                color: "#d93025",
                              }}
                            >
                              {deletingProjectId === project.id ? "삭제 중..." : "삭제"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section style={{ marginBottom: isMobile ? "18px" : "22px" }}>
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                style={{
                  padding: isMobile ? "8px 13px" : "10px 16px",
                  borderRadius: "999px",
                  border: activeTag === tag ? "1px solid #111" : "1px solid #e5e5e5",
                  background: activeTag === tag ? "#111" : "white",
                  color: activeTag === tag ? "white" : "#111",
                  cursor: "pointer",
                  fontSize: isMobile ? "13px" : "14px",
                  fontWeight: 700,
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <section
          style={{
            textAlign: "center",
            marginBottom: isMobile ? "22px" : "34px",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? "36px" : isTablet ? "54px" : "72px",
              lineHeight: 1.02,
              margin: "0 0 12px",
              fontWeight: 900,
              letterSpacing: isMobile ? "-1.2px" : "-2.4px",
            }}
          >
            {selectedProject ? selectedProject.name : "레퍼런스 보드"}
          </h2>
        </section>

        {selectedProject && filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#666",
              padding: isMobile ? "56px 18px" : "80px 20px",
              borderRadius: "24px",
              background: "white",
              border: "1px solid #ececec",
            }}
          >
            등록된 이미지가 없습니다.
          </div>
        ) : (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: imageGridColumns,
              gap: isMobile ? "14px" : "18px",
              alignItems: "start",
            }}
          >
            {filteredItems.map((item) => (
              <article
                key={item.id}
                style={{
                  background: "white",
                  borderRadius: "20px",
                  overflow: "hidden",
                  border:
                    selectedItemId === item.id
                      ? "2px solid #111"
                      : "1px solid #ececec",
                  boxShadow:
                    selectedItemId === item.id
                      ? "0 18px 40px rgba(0,0,0,0.10)"
                      : "0 6px 16px rgba(0,0,0,0.04)",
                  transition: "0.2s ease",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  <img
                    src={item.image_url}
                    style={{
                      width: "100%",
                      display: "block",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      background: "#ddd",
                    }}
                  />

                  {isYoutubeItem(item) && (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: isMobile ? "48px" : "54px",
                        height: isMobile ? "48px" : "54px",
                        borderRadius: "999px",
                        background: "rgba(0,0,0,0.62)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isMobile ? "21px" : "24px",
                        fontWeight: 900,
                        pointerEvents: "none",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                      }}
                    >
                      ▶
                    </div>
                  )}

                  <div
                    className="image-overlay"
                    style={{
                      position: "absolute",
                      left: "0",
                      right: "0",
                      bottom: "0",
                      padding: "14px",
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.35), transparent)",
                      color: "white",
                      opacity: isMobile ? 1 : 0,
                      transform: isMobile ? "translateY(0)" : "translateY(10px)",
                      transition: "all 0.22s ease",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        lineHeight: 1.45,
                        marginBottom: "10px",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                      }}
                    >
                      {item.note || "메모 없음"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      {(item.tags || []).length > 0 ? (
                        (item.tags || []).map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: "11px",
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "rgba(255,255,255,0.16)",
                              border: "1px solid rgba(255,255,255,0.2)",
                              backdropFilter: "blur(4px)",
                            }}
                          >
                            #{tag}
                          </span>
                        ))
                      ) : (
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            background: "rgba(255,255,255,0.16)",
                            border: "1px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          태그 없음
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "14px 14px 16px" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#333",
                      lineHeight: 1.45,
                      minHeight: isMobile ? "auto" : "42px",
                      marginBottom: "10px",
                    }}
                  >
                    {item.note || "메모 없음"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    {(item.tags || []).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "12px",
                          padding: "5px 9px",
                          borderRadius: "999px",
                          background: "#f5f5f5",
                          border: "1px solid #e8e8e8",
                          color: "#333",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {selectedItem && (
        <div
          onClick={() => setSelectedItemId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            justifyContent: "center",
            alignItems: isMobile ? "flex-start" : "center",
            padding: isMobile ? "12px" : "20px",
            zIndex: 30,
            backdropFilter: "blur(6px)",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              color: "#111",
              padding: isMobile ? "16px" : "22px",
              borderRadius: isMobile ? "22px" : "26px",
              width: isMobile ? "100%" : "min(92vw, 1100px)",
              maxHeight: isMobile ? "none" : "92vh",
              overflowY: "auto",
              boxShadow: "0 26px 60px rgba(0,0,0,0.24)",
            }}
          >
            <img
              src={selectedItem.image_url}
              style={{
                width: "100%",
                maxHeight: isMobile ? "360px" : "58vh",
                objectFit: "contain",
                borderRadius: "18px",
                background: "#f4f4f4",
                display: "block",
              }}
            />

            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => updateNote(selectedItem.id, noteDraft)}
              placeholder="메모 작성"
              style={{
                width: "100%",
                marginTop: "14px",
                padding: "14px",
                minHeight: isMobile ? "100px" : "120px",
                borderRadius: "16px",
                border: "1px solid #dfdfdf",
                fontSize: "15px",
                outline: "none",
                resize: "vertical",
              }}
            />

            <div style={{ marginTop: "14px" }}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: "10px",
                  fontSize: "15px",
                }}
              >
                참고 링크
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  gap: "8px",
                }}
              >
                <input
                  value={referenceLinkDraft}
                  onChange={(e) => setReferenceLinkDraft(e.target.value)}
                  onBlur={() => updateReferenceLink(selectedItem.id, referenceLinkDraft)}
                  placeholder="https://example.com"
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: "16px",
                    border: "1px solid #dfdfdf",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />

                {!!referenceLinkDraft.trim() && (
                  <a
                    href={referenceLinkDraft}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "12px 18px",
                      borderRadius: "16px",
                      background: "#111",
                      color: "white",
                      textDecoration: "none",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    링크 열기
                  </a>
                )}
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: "10px",
                  fontSize: "15px",
                }}
              >
                태그
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                {(selectedItem.tags || []).map((tag, index) => (
                  <button
                    key={index}
                    onClick={() => removeTag(tag)}
                    style={{
                      border: "1px solid #e5e5e5",
                      background: "white",
                      borderRadius: "999px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    #{tag} ✕
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  gap: "8px",
                }}
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="태그 입력"
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: "16px",
                    border: "1px solid #dfdfdf",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />

                <button
                  onClick={() => addTag()}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "16px",
                    border: "none",
                    background: "#111",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  태그 추가
                </button>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: "10px",
                  fontSize: "15px",
                }}
              >
                다른 프로젝트에 복사
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  gap: "8px",
                }}
              >
                <select
                  value={copyTargetProjectId}
                  onChange={(e) => setCopyTargetProjectId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: "16px",
                    border: "1px solid #dfdfdf",
                    fontSize: "14px",
                    outline: "none",
                    background: "white",
                  }}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={copyItemToProject}
                  disabled={copyingItem}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "16px",
                    border: "none",
                    background: "#111",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  {copyingItem ? "복사 중..." : "복사"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "8px",
                marginTop: "18px",
              }}
            >
              <button
                onClick={() => deleteItem(selectedItem.id)}
                style={{
                  padding: "12px 18px",
                  borderRadius: "16px",
                  border: "none",
                  background: "#d93025",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                삭제
              </button>

              <button
                onClick={() => setSelectedItemId(null)}
                style={{
                  padding: "12px 18px",
                  borderRadius: "16px",
                  border: "1px solid #dfdfdf",
                  background: "white",
                  color: "#111",
                  cursor: "pointer",
                  fontWeight: 700,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}