// Bu sayfayı "use client" ile işaretliyoruz çünkü:
// - Supabase ile oturum (auth), profil ve görev sorguları yapacağız,
// - Yeni görev eklerken Supabase'e INSERT isteği göndereceğiz,
// - RBAC (sadece owner/manager/ekip rolleri görebilsin) kontrolü uygulayacağız,
// - Sidebar için mobil aç/kapa state'ini yöneteceğiz.
"use client";

// React'ten useEffect ve useState hook'larını içe aktarıyoruz.
import { useEffect, useState } from "react";

// Next.js App Router'da istemci tarafı yönlendirme yapmak için useRouter hook'unu kullanıyoruz.
import { useRouter } from "next/navigation";

// Supabase istemcisini, daha önce oluşturduğumuz lib/supabase.ts dosyasından içe aktarıyoruz.
import { supabase } from "@/lib/supabase";

// Merkezi Sidebar bileşenimizi içe aktarıyoruz.
import { Sidebar } from "@/components/Sidebar";

// Lucide-react ikonlarını içe aktarıyoruz.
// NOT: Bunlar sadece görsellik amacıyla kullanılıyor, herhangi bir ek mantık içermez.
import { ClipboardCheck, Calendar, User as UserIcon } from "lucide-react";

// Supabase "profiles" tablosu tipi (minimum alanlarla).
type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  agency_id: string | null;
};

// Supabase "projects" tablosu tipi (minimum alanlarla).
type Project = {
  id: string;
  name: string;
};

// Supabase "tasks" tablosu tipi (tahmini alanlar).
// NOT: Şema farklıysa sadece fazladan alanlar göz ardı edilir; kritik olanlar id, title, project_id, assigned_to, priority, status, due_date.
type Task = {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  assigned_to: string | null;
  priority: "low" | "medium" | "high" | "urgent" | null;
  status: "todo" | "in_progress" | "review" | "done" | null;
  due_date: string | null;
};

export default function TasksPage() {
  // Oturum (session) bilgisini tutmak için bir state.
  const [session, setSession] = useState<
    Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null
  >(null);

  // Kullanıcının e-posta bilgisini header'da göstermek için.
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Oturum kontrolü yükleniyor durumu.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Giriş yapan kullanıcının profil bilgisi.
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // Profil sorgusu yükleniyor durumu.
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Profil sorgusunda hata olursa gösterilecek mesaj.
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(
    null
  );

  // Ajansa ait görev, proje ve ekip listeleri.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);

  // Görevler ve dropdownlar için yükleniyor durumları.
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [isOptionsLoading, setIsOptionsLoading] = useState(true);

  // Proje filtreleme için seçili proje id'si (veya "all").
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");

  // Yeni görev modalının açık/kapalı durumu.
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  // Yeni görev form alanları.
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "medium" | "high" | "urgent" | ""
  >("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>("");

  // Yeni görev kaydedilirken loading durumu.
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Sidebar mobil aç/kapa durumu.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const router = useRouter();

  // SAYFA 1: OTURUM (AUTH) KONTROLÜ
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Oturum kontrolü sırasında hata:", error.message);
          router.push("/login");
          return;
        }

        if (!data.session) {
          router.push("/login");
          return;
        }

        setSession(data.session);
        const emailFromSession = data.session.user.email ?? null;
        setUserEmail(emailFromSession);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, [router]);

  // SAYFA 2: PROFİL SORGUSU (RBAC VE AGENCY_ID İÇİN)
  useEffect(() => {
    if (!session) return;

    const fetchCurrentProfile = async () => {
      setIsProfileLoading(true);
      setProfileErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error("Profil bilgisi alınırken hata:", error.message);
          setProfileErrorMessage(
            "Profil bilgileriniz alınırken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
          );
          return;
        }

        if (!data) {
          console.error(
            "Profil kaydınız bulunamadı. Lütfen sistem yöneticinizle iletişime geçin."
          );
          setProfileErrorMessage(
            "Profil kaydınız bulunamadı. Lütfen sistem yöneticinizle iletişime geçin."
          );
          return;
        }

        setCurrentProfile(data as Profile);
        console.log("TasksPage currentProfile:", data);
      } catch (err) {
        console.error(
          "Profil bilgisi alınırken beklenmeyen bir hata oluştu:",
          err
        );
        setProfileErrorMessage(
          "Profil bilgileriniz alınırken beklenmeyen bir hata oluştu."
        );
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchCurrentProfile();
  }, [session]);

  // RBAC: sadece owner / manager ve ekip rolleri (client hariç tüm roller) görebilsin.
  const isAuthorized =
    currentProfile && currentProfile.role && currentProfile.role !== "client";

  // SAYFA 3: AJANSA AİT GÖREV / PROJE / EKİP VERİLERİNİ ÇEKME
  useEffect(() => {
    if (!currentProfile || !currentProfile.agency_id || !isAuthorized) return;

    const fetchTasksAndOptions = async () => {
      setIsTasksLoading(true);
      setIsOptionsLoading(true);

      try {
        // 1) Projeler (dropdown ve tablo için)
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name")
          .eq("agency_id", currentProfile.agency_id)
          .order("name", { ascending: true });

        if (projectsError) {
          console.error(
            "Projeler alınırken bir hata oluştu:",
            projectsError.message
          );
        } else {
          setProjects((projectsData as Project[]) || []);
        }

        // 2) Ekip üyeleri (müşteri hariç, görevi atayacağımız kullanıcılar)
        const { data: teamData, error: teamError } = await supabase
          .from("profiles")
          .select("*")
          .eq("agency_id", currentProfile.agency_id)
          .neq("role", "client")
          .order("full_name", { ascending: true });

        if (teamError) {
          console.error(
            "Ekip listesi alınırken bir hata oluştu:",
            teamError.message
          );
        } else {
          setTeamMembers((teamData as Profile[]) || []);
        }

        setIsOptionsLoading(false);

        // 3) Görevler
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .eq("agency_id", currentProfile.agency_id)
          .order("due_date", { ascending: true });

        if (tasksError) {
          console.error(
            "Görevler alınırken bir hata oluştu:",
            tasksError.message
          );
        } else {
          setTasks((tasksData as Task[]) || []);
        }
      } catch (err) {
        console.error(
          "Görev, proje veya ekip verileri alınırken beklenmeyen bir hata oluştu:",
          err
        );
      } finally {
        setIsTasksLoading(false);
      }
    };

    fetchTasksAndOptions();
  }, [currentProfile, isAuthorized]);

  // Yardımcı: Görev listesini yenile (yeni görev eklendikten sonra).
  const refreshTasks = async () => {
    if (!currentProfile || !currentProfile.agency_id) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("agency_id", currentProfile.agency_id)
        .order("due_date", { ascending: true });

      if (error) {
        console.error(
          "Görevler yenilenirken bir hata oluştu:",
          error.message
        );
        return;
      }

      setTasks((data as Task[]) || []);
    } catch (err) {
      console.error(
        "Görevler yenilenirken beklenmeyen bir hata oluştu:",
        err
      );
    }
  };

  // YENİ GÖREV OLUŞTURMA İŞLEMİ
  const handleCreateTask = async () => {
    if (!newTaskTitle || !newTaskProjectId || !newTaskAssigneeId) {
      alert("Lütfen Görev Adı, Proje ve Atanan Kişi alanlarını doldurun.");
      return;
    }

    if (!currentProfile || !currentProfile.agency_id) {
      alert(
        "Ajans bilgisi alınamadı. Lütfen sayfayı yenileyip tekrar deneyin."
      );
      return;
    }

    setIsCreatingTask(true);

    try {
      const { error } = await supabase.from("tasks").insert({
        title: newTaskTitle,
        description: newTaskDescription || null,
        project_id: newTaskProjectId,
        assigned_to: newTaskAssigneeId,
        priority: newTaskPriority || "medium",
        status: "todo",
        due_date: newTaskDueDate || null,
        agency_id: currentProfile.agency_id,
      });

      // Mevcut hata bloğunu isteğin doğrultusunda güncelliyoruz:
      if (error) {
        console.error("DETAYLI VERİTABANI HATASI:", error); // Bu satır altın değerinde!
        alert(`Hata Detayı: ${error.message} - ${error.details}`);
        return;
      }

      // Formu temizle ve modalı kapat.
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskProjectId("");
      setNewTaskAssigneeId("");
      setNewTaskPriority("");
      setNewTaskDueDate("");
      setIsNewTaskModalOpen(false);

      // Görevleri yenile.
      await refreshTasks();
    } catch (err) {
      console.error(
        "Görev oluşturma sırasında beklenmeyen bir hata oluştu:",
        err
      );
      alert(
        "Görev oluşturma sırasında beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin."
      );
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Yetkisiz veya profil hatası durumları için erken dönüşler.
  if (isCheckingSession || isProfileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Oturum ve profil bilgileriniz yükleniyor...
      </div>
    );
  }

  if (!currentProfile || profileErrorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center text-sm text-slate-600 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-100">
          <p className="mb-1 font-semibold text-slate-900">
            Profil bilgilerinize ulaşılamadı
          </p>
          <p className="text-xs text-slate-500">
            {profileErrorMessage ??
              "Profil kaydınız bulunamadığı için bu sayfayı görüntüleyemiyorsunuz. Lütfen sistem yöneticinizle iletişime geçin."}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center text-sm text-slate-600 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm shadow-amber-100">
          <p className="mb-1 font-semibold text-amber-900">
            Bu sayfayı görüntüleme yetkiniz yok
          </p>
          <p className="text-xs text-amber-700">
            Görev yönetimi sadece ajans sahibi (owner), ajans yöneticisi
            (manager) ve ekip üyeleri içindir. Müşteri hesapları bu sayfayı
            göremez.
          </p>
        </div>
      </div>
    );
  }

  // Yardımcı: ID -> Ad map'leri (proje ve ekip için) görev tablosunda isim göstermek için.
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const memberMap = new Map(
    teamMembers.map((m) => [m.id, m.full_name || m.email || "Bilinmeyen Kullanıcı"])
  );

  // Filtrelenmiş görev listesi (seçili projeye göre).
  const filteredTasks =
    selectedProjectFilter === "all"
      ? tasks
      : tasks.filter((t) => t.project_id === selectedProjectFilter);

  // Durum badge renkleri.
  const getStatusBadgeClasses = (status: Task["status"]) => {
    switch (status) {
      case "todo":
        return "border-slate-200 bg-slate-50 text-slate-700";
      case "in_progress":
        return "border-sky-200 bg-sky-50 text-sky-700";
      case "review":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "done":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  };

  // Öncelik badge renkleri (görsel ipucu için).
  const getPriorityBadgeClasses = (priority: Task["priority"]) => {
    switch (priority) {
      case "low":
        return "border-slate-200 bg-slate-50 text-slate-600";
      case "medium":
        return "border-sky-200 bg-sky-50 text-sky-700";
      case "high":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "urgent":
        return "border-rose-200 bg-rose-50 text-rose-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-600";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative mx-auto flex min-h-screen max-w-7xl">
        <Sidebar
          role={currentProfile.role}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobil hamburger */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shadow-sm lg:hidden"
                aria-label="Menüyü aç"
              >
                <span className="space-y-1">
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                </span>
              </button>

              {/* Logo + başlık */}
              <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold text-white shadow-sm lg:flex">
                U
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Modül
                </p>
                <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Görevler
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-slate-400">Oturum Açık</p>
                <p className="text-sm font-semibold text-slate-900">
                  {userEmail ?? "Kullanıcı"}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  ⎋
                </span>
                <span>Çıkış Yap</span>
              </button>
            </div>
          </header>

          {/* İçerik */}
          <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {/* Üst satır: başlık, filtre ve yeni görev butonu */}
              <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Görev Yönetimi
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Ajans içi görevleri proje ve ekip üyelerine göre organize edin.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {/* Proje filtresi */}
                  <select
                    value={selectedProjectFilter}
                    onChange={(e) => setSelectedProjectFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:w-48"
                    disabled={isOptionsLoading}
                  >
                    <option value="all">Tüm Projeler</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  {/* Yeni görev butonu */}
                  <button
                    type="button"
                    onClick={() => setIsNewTaskModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Yeni Görev Ekle
                  </button>
                </div>
              </section>

              {/* Görevler listesi */}
              <section>
                {isTasksLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-sm text-slate-500">
                    Görevler yükleniyor...
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Seçilen filtreye uygun görev bulunamadı.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Yeni bir görev ekleyerek listeleri doldurmaya başlayabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100">
                    <div className="hidden bg-slate-50/80 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:grid sm:grid-cols-12">
                      <div className="col-span-3">Görev Adı</div>
                      <div className="col-span-2">Proje</div>
                      <div className="col-span-2">Atanan</div>
                      <div className="col-span-2">Öncelik</div>
                      <div className="col-span-2">Durum</div>
                      <div className="col-span-1 text-right">
                        <Calendar className="inline h-3 w-3" />
                      </div>
                    </div>

                    <ul className="divide-y divide-slate-100 text-sm">
                      {filteredTasks.map((task) => (
                        <li
                          key={task.id}
                          className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-12 sm:items-center sm:px-6"
                        >
                          <div className="col-span-3">
                            <p className="font-medium text-slate-900">
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <div className="col-span-2 text-slate-600">
                            {task.project_id
                              ? projectMap.get(task.project_id) ?? "Bilinmeyen Proje"
                              : "-"}
                          </div>
                          <div className="col-span-2 flex items-center gap-2 text-slate-600">
                            <UserIcon className="h-3 w-3 text-slate-400" />
                            <span>
                              {task.assigned_to
                                ? memberMap.get(task.assigned_to) ?? "Bilinmeyen Kullanıcı"
                                : "-"}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getPriorityBadgeClasses(
                                task.priority
                              )}`}
                            >
                              {task.priority === "low"
                                ? "Düşük"
                                : task.priority === "medium"
                                ? "Orta"
                                : task.priority === "high"
                                ? "Yüksek"
                                : task.priority === "urgent"
                                ? "Acil"
                                : "Belirtilmedi"}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getStatusBadgeClasses(
                                task.status
                              )}`}
                            >
                              {task.status === "todo"
                                ? "Todo"
                                : task.status === "in_progress"
                                ? "In Progress"
                                : task.status === "review"
                                ? "Review"
                                : task.status === "done"
                                ? "Done"
                                : "Belirtilmedi"}
                            </span>
                          </div>
                          <div className="col-span-1 text-right text-xs text-slate-500">
                            {task.due_date
                              ? new Date(task.due_date).toLocaleDateString("tr-TR")
                              : "-"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>

      {/* Yeni Görev Ekle "modal" kartı (overlay yerine sayfa içinde kart) */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Yeni Görev Ekle
              </h2>
              <button
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Kapat
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="task_title"
                  className="block text-xs font-medium text-slate-700"
                >
                  Görev Adı
                </label>
                <input
                  id="task_title"
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Örn: Vita Emlak banner tasarımı"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <label
                  htmlFor="task_description"
                  className="block text-xs font-medium text-slate-700"
                >
                  Açıklama
                </label>
                <textarea
                  id="task_description"
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Görevin detaylarını buraya yazabilirsiniz..."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  rows={3}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Proje seçimi */}
                <div>
                  <label
                    htmlFor="task_project"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Proje
                  </label>
                  <select
                    id="task_project"
                    value={newTaskProjectId}
                    onChange={(e) => setNewTaskProjectId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">Bir proje seçin</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ekip üyesi seçimi */}
                <div>
                  <label
                    htmlFor="task_assignee"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Atanan Kişi
                  </label>
                  <select
                    id="task_assignee"
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">Bir ekip üyesi seçin</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email || "Bilinmeyen Kullanıcı"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Öncelik */}
                <div>
                  <label
                    htmlFor="task_priority"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Öncelik
                  </label>
                  <select
                    id="task_priority"
                    value={newTaskPriority}
                    onChange={(e) =>
                      setNewTaskPriority(
                        e.target.value as "low" | "medium" | "high" | "urgent" | ""
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="medium">Orta (Varsayılan)</option>
                    <option value="low">Düşük</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>

                {/* Bitiş tarihi */}
                <div>
                  <label
                    htmlFor="task_due_date"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Bitiş Tarihi
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    <input
                      id="task_due_date"
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full border-0 bg-transparent text-xs text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={isCreatingTask}
                className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {isCreatingTask ? "Kaydediliyor..." : "Görevi Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

