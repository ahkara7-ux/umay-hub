// Bu sayfayı "use client" ile işaretliyoruz çünkü:
// - Supabase ile oturum (auth) kontrolü yapacağız,
// - Proje listesi için veritabanından veri çekeceğiz,
// - Yeni proje oluşturma formu ile Supabase'e INSERT isteği göndereceğiz,
// - Yönlendirme (router.push) işlemleri için tarayıcı tarafında çalışmamız gerekiyor.
"use client";

// React'ten useEffect ve useState hook'larını içe aktarıyoruz.
// useState: bileşen içinde durum (state) yönetmek için kullanılır.
// useEffect: bileşen yüklendiğinde veya belirli bir state/prop değiştiğinde yan etkileri (fetch, insert vb.) çalıştırmak için kullanılır.
import { useEffect, useState } from "react";

// Next.js App Router'da istemci tarafı yönlendirme yapmak için useRouter hook'unu kullanıyoruz.
// Örneğin: başarılı çıkıştan sonra "/login" sayfasına yönlendirmek için.
import { useRouter } from "next/navigation";

// Supabase istemcisini, daha önce oluşturduğumuz lib/supabase.ts dosyasından içe aktarıyoruz.
// Bu istemci sayesinde Supabase veritabanına sorgu atabileceğiz.
import { supabase } from "@/lib/supabase";

// Merkezi Sidebar bileşenimizi içe aktarıyoruz.
// Böylece tüm sayfalarda aynı menüyü (Link + active state + RBAC) kullanacağız.
import { Sidebar } from "@/components/Sidebar";

// Supabase üzerindeki "projects" tablosundaki kayıtların tipini TypeScript ile tanımlıyoruz.
// Burada tablo sütunlarını basitçe modellemek yeterli:
// - id: Her projenin benzersiz kimliği (primary key)
// - name: Proje adı (Örn: Kış Kampanyası)
// - client_name: Müşteri marka adı (Örn: Vita Emlak)
// - client_email: Müşterinin e-posta adresi (RLS için kritik alan)
// - status: Projenin durumu (Örn: Aktif, Tamamlandı, Beklemede)
// - created_at: Projenin oluşturulma tarihi
type Project = {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  status: string | null;
  created_at: string;
};

// Supabase üzerindeki "profiles" tablosundaki kayıtların tipini TypeScript ile tanımlıyoruz.
// Bu sayfada role ve agency_id alanlarını kullanacağız.
type Profile = {
  id: string;
  email: string | null;
  role: string | null;
  agency_id: string | null;
};

// "Projeler" sayfasının ana bileşenini tanımlıyoruz.
// Bu dosya app/projects/page.tsx olduğu için, Next.js bu bileşeni "/projects" rotasında gösterecektir.
export default function ProjectsPage() {
  // Oturum (session) bilgisini tutmak için bir state tanımlıyoruz.
  // Başlangıç değeri null: Henüz oturum bilgisi çekilmedi anlamına geliyor.
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >["data"]["session"] | null>(null);

  // Kullanıcının e-posta bilgisini header'da göstermek için ayrı bir state kullanıyoruz.
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Oturum kontrolü yapılırken kısa süreli "yükleniyor" durumu göstermek için kullanacağımız state.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Proje listesini tutmak için bir dizi state tanımlıyoruz.
  const [projects, setProjects] = useState<Project[]>([]);

  // Proje verileri Supabase'den çekilirken bir yükleniyor durumu göstermek için kullanacağımız state.
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  // Yeni proje oluşturma formundaki alanları yönetmek için state'ler:
  // Proje Adı
  const [newProjectName, setNewProjectName] = useState<string>("");
  // Müşteri Marka Adı
  const [newClientName, setNewClientName] = useState<string>("");
  // Müşteri E-posta Adresi (Supabase "client_email" sütununa yazılacak)
  const [newClientEmail, setNewClientEmail] = useState<string>("");

  // "Projeyi Başlat" butonuna basıldığında INSERT işlemi devam ederken
  // butonu devre dışı bırakmak için kullanacağımız state.
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Mobil cihazlarda sol menünün (sidebar) açılıp kapanma durumunu yönetmek için bir state tanımlıyoruz.
  // false: Menü kapalı, true: Menü açık (ekranın solundan kayan drawer olarak görünecek).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Giriş yapan kullanıcının profil bilgisini (profiles tablosundan) saklamak için bir state.
  // Burada özellikle role ve agency_id alanları bizim için önemli.
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // Profil bilgisi çekilirken kısa süreli bir yükleniyor durumu göstermek istersek kullanabileceğimiz state.
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Kullanıcının ajans çalışanı olup olmadığını tutan basit bir bayrak (flag) state.
  // - true: owner, manager veya başka bir ajans personeli (client dışı roller)
  // - false: client rolü (müşteri) veya profil bulunamadı.
  const [isAgencyStaff, setIsAgencyStaff] = useState(false);

  // Yönlendirme işlemleri (login sayfasına atmak vb.) için router nesnesini alıyoruz.
  const router = useRouter();

  // SAYFA 1: OTURUM (AUTH) KONTROLÜ
  // Bu useEffect, bileşen yüklendiğinde Supabase üzerinden aktif oturum var mı diye kontrol eder.
  useEffect(() => {
    // Asenkron oturum kontrol fonksiyonumuzu tanımlıyoruz.
    const checkSession = async () => {
      try {
        // Supabase'ten mevcut oturumu (session) istiyoruz.
        const { data, error } = await supabase.auth.getSession();

        // Eğer Supabase bir hata döndürdüyse (örneğin bağlantı sorunu), konsola yazıyoruz
        // ve kullanıcıyı güvenlik için login sayfasına yönlendiriyoruz.
        if (error) {
          console.error("Oturum kontrolü sırasında hata:", error.message);
          router.push("/login");
          return;
        }

        // Eğer oturum yoksa (kullanıcı giriş yapmamışsa), login sayfasına atıyoruz.
        if (!data.session) {
          router.push("/login");
          return;
        }

        // Buraya geliyorsak, aktif bir oturum var demektir; state'i güncelliyoruz.
        setSession(data.session);

        // Kullanıcının e-posta bilgisini session içinden alıp header'da göstermek için saklıyoruz.
        const emailFromSession = data.session.user.email ?? null;
        setUserEmail(emailFromSession);
      } finally {
        // Hangi durumda olursa olsun (başarılı veya hatalı) kontrol bittiğinde
        // yükleniyor durumunu false yapıyoruz ki arayüzü gösterebilelim.
        setIsCheckingSession(false);
      }
    };

    // Tanımladığımız oturum kontrol fonksiyonunu hemen çağırıyoruz.
    checkSession();
  }, [router]);

  // SAYFA 1.5: GİRİŞ YAPAN KULLANICININ PROFİLİNİ ÇEKME
  // Oturum kontrolü başarıyla geçildikten ve userEmail state'i dolduktan sonra,
  // Supabase'deki "profiles" tablosundan, bu e-posta ile eşleşen profil kaydını çekiyoruz.
  useEffect(() => {
    // Eğer henüz oturum veya e-posta bilgisi yoksa profil sorgusuna başlamıyoruz.
    if (!session || !userEmail) return;

    const fetchCurrentProfile = async () => {
      setIsProfileLoading(true);

      try {
        // profiles tablosundan e-posta adresine göre profil kaydını alıyoruz.
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, role, agency_id")
          .eq("email", userEmail)
          .single();

        if (error) {
          console.error(
            "Profil bilgisi alınırken bir hata oluştu:",
            error.message
          );
          // Hata durumunda profil bilgisini sıfırlayıp ajans çalışanı bayrağını false yapıyoruz.
          setCurrentProfile(null);
          setIsAgencyStaff(false);
          return;
        }

        const profile = data as Profile;
        setCurrentProfile(profile);

        // Rol bazlı kontrol:
        // Eğer kullanıcının rolü "client" DEĞİLSE (owner, manager, videographer vb. ise)
        // isAgencyStaff true olur ve formu gösterebiliriz.
        // Rolü "client" olan kullanıcıların ise sadece listeyi görmesini istiyoruz.
        if (profile.role && profile.role !== "client") {
          setIsAgencyStaff(true);
        } else {
          setIsAgencyStaff(false);
        }
      } catch (err) {
        console.error(
          "Profil bilgisi alınırken beklenmeyen bir hata oluştu:",
          err
        );
        setCurrentProfile(null);
        setIsAgencyStaff(false);
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchCurrentProfile();
  }, [session, userEmail]);

  // SAYFA 2: PROJE LİSTESİNİ SUPABASE'DEN ÇEKME
  // Oturum kontrolü başarıyla geçildikten sonra (session dolu olduğunda),
  // Supabase'deki "projects" tablosundan verileri çekiyoruz.
  useEffect(() => {
    // Eğer henüz oturum veya profil/ajans bilgisi yoksa (örneğin kontrol devam ediyorsa),
    // verileri çekmeye başlamıyoruz.
    if (!session || !currentProfile?.agency_id) return;

    // Asenkron veri çekme fonksiyonumuzu tanımlıyoruz.
    const fetchProjects = async () => {
      // Veri çekme başlarken yükleniyor durumunu true yapıyoruz.
      setIsProjectsLoading(true);

      try {
        // Supabase'deki "projects" tablosundan tüm satırları çekiyoruz.
        // order("created_at", { ascending: false }): En yeni kayıt en üstte olacak şekilde sıralar.
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("agency_id", currentProfile.agency_id)
          .order("created_at", { ascending: false });

        // Eğer Supabase bir hata döndürdüyse, bunu konsola yazıyoruz.
        if (error) {
          console.error(
            "Proje listesi alınırken bir hata oluştu:",
            error.message
          );
          return;
        }

        // Hata yoksa, dönen veriyi (data) state'e yazıyoruz.
        setProjects((data as Project[]) || []);
      } catch (err) {
        // Beklenmeyen bir hata durumunda (örneğin ağ kopması) basit bir log yazıyoruz.
        console.error(
          "Proje listesi alınırken beklenmeyen bir hata oluştu:",
          err
        );
      } finally {
        // Hangi durumda olursa olsun, veri çekme işlemi bittiğinde yükleniyor durumunu false yapıyoruz.
        setIsProjectsLoading(false);
      }
    };

    // Tanımladığımız veri çekme fonksiyonunu çağırıyoruz.
    fetchProjects();
  }, [session]);

  // Proje listesini yenilemek (örneğin yeni bir proje oluşturulduktan sonra)
  // en güncel veriyi getirmek için kullanacağımız yardımcı fonksiyon.
  const refreshProjects = async () => {
    if (!currentProfile?.agency_id) return;
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("agency_id", currentProfile.agency_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "Proje listesi yenilenirken bir hata oluştu:",
          error.message
        );
        return;
      }

      setProjects((data as Project[]) || []);
    } catch (err) {
      console.error(
        "Proje listesi yenilenirken beklenmeyen bir hata oluştu:",
        err
      );
    }
  };

  // KULLANICI "ÇIKIŞ YAP" BUTONUNA BASTIĞINDA ÇALIŞACAK FONKSİYON
  const handleLogout = async () => {
    try {
      // Supabase üzerinden oturumu sonlandırmak için signOut fonksiyonunu kullanıyoruz.
      const { error } = await supabase.auth.signOut();

      // Eğer bir hata dönerse, konsola yazıyoruz.
      if (error) {
        console.error("Çıkış yapılırken bir hata oluştu:", error.message);
      }
    } finally {
      // Her durumda (hata olsa bile) kullanıcıyı login sayfasına yönlendiriyoruz.
      router.push("/login");
    }
  };

  // YENİ PROJE OLUŞTURMA İŞLEMİ
  // Bu fonksiyon, formdaki "Projeyi Başlat" butonuna basıldığında çalışır.
  // Formdan aldığı değerlerle Supabase'teki "projects" tablosuna yeni bir kayıt ekler.
  const handleCreateProject = async () => {
    // Önce profil ve ajans bilgimizin gerçekten yüklendiğinden emin oluyoruz.
    // Eğer currentProfile veya agency_id yoksa, RLS kuralları nedeniyle insert işlemi hata verebilir.
    if (!currentProfile || !currentProfile.agency_id) {
      alert(
        "Ajans bilginiz bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin veya sistem yöneticinize haber verin."
      );
      console.error(
        "PROJE EKLEME HATASI: currentProfile veya agency_id eksik:",
        currentProfile
      );
      return;
    }

    // Önce basit bir doğrulama yapıyoruz: Zorunlu alanlar doldurulmuş mu?
    if (!newProjectName || !newClientName || !newClientEmail) {
      alert(
        "Lütfen Proje Adı, Müşteri Marka Adı ve Müşteri E-posta Adresi alanlarını doldurun."
      );
      return;
    }

    // E-posta formatı için çok basit bir kontrol ekleyebiliriz (isteğe bağlı).
    if (!newClientEmail.includes("@")) {
      alert("Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    // Insert işlemi başladığı için butonu devre dışı bırakmak üzere loading durumunu true yapıyoruz.
    setIsCreatingProject(true);

    try {
      // Formdaki metin değerlerini kırpıyoruz (boşlukları temizliyoruz).
      const trimmedProjectName = newProjectName.trim();
      const trimmedClientName = newClientName.trim();
      const trimmedClientEmail = newClientEmail.trim();

      // Eğer ileride "Müşteri Seçimi" gibi opsiyonel alanlar eklenirse ve boş bırakılırsa,
      // Supabase'e boş string yerine null göndererek olası NOT NULL hatalarının önüne geçiyoruz.
      const safeClientName = trimmedClientName === "" ? null : trimmedClientName;
      const safeClientEmail =
        trimmedClientEmail === "" ? null : trimmedClientEmail;

      // Supabase üzerindeki "projects" tablosuna yeni bir satır ekliyoruz.
      // Burada:
      // - name: Proje adı
      // - client_name: Müşteri marka adı
      // - client_email: Müşteri e-posta adresi (RLS için kritik alan)
      // - status: Varsayılan olarak "Aktif" durumu ile başlatıyoruz (ihtiyaca göre değiştirilebilir).
      // - agency_id: Giriş yapan ajans çalışanının agency_id değeri (projenin hangi ajansa ait olduğunu belirtmek için)
      const { error } = await supabase.from("projects").insert({
        name: trimmedProjectName,
        client_name: safeClientName,
        client_email: safeClientEmail,
        status: "Aktif",
        agency_id: currentProfile.agency_id,
      });

      // Eğer Supabase bir hata döndürdüyse, kullanıcıya basit bir uyarı gösteriyoruz
      // ve hatayı konsola yazıyoruz.
      if (error) {
        console.error("PROJE EKLEME HATASI:", error);
        alert(
          "Proje eklenirken bir hata oluştu. Lütfen tekrar deneyin veya sistem yöneticinize haber verin."
        );
        return;
      }

      // Ekleme işlemi başarılıysa, form alanlarını temizliyoruz.
      setNewProjectName("");
      setNewClientName("");
      setNewClientEmail("");

      // Ardından proje listesini yeniliyoruz ki yeni eklenen kayıt hemen ekranda görünsün.
      await refreshProjects();
    } catch (err) {
      console.error(
        "PROJE EKLEME HATASI (beklenmeyen):",
        err
      );
      alert(
        "Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin."
      );
    } finally {
      // Hangi durumda olursa olsun, işlem bittiğinde loading durumunu false yapıyoruz.
      setIsCreatingProject(false);
    }
  };

  // Eğer oturum kontrolü hala devam ediyorsa, basit bir yükleniyor ekranı gösteriyoruz.
  // Ayrıca profil bilgisi de yükleniyorsa, yine aynı bekleme ekranını gösterebiliriz.
  if (isCheckingSession || isProfileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Oturum kontrol ediliyor...
      </div>
    );
  }

  // Buraya gelindiyse ve yönlendirme yapılmadıysa, aktif bir oturum vardır.
  // Artık Projeler arayüzünü gösterebiliriz.
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Ana layout: Sol tarafta sabit sidebar, sağ tarafta içerik alanı */}
      <div className="relative mx-auto flex min-h-screen max-w-7xl">
        {/* Merkezi Sidebar:
            - next/link ile sayfa geçişleri
            - aktif sayfa vurgusu
            - RBAC (client rolünde bazı linkleri gizleme)
            - mobil drawer + overlay kapanma davranışı */}
        <Sidebar
          role={currentProfile?.role ?? null}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Sağ ana bölüm */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header - Diğer sayfalardaki header'ın aynısını kullanıyoruz, sadece başlığı değiştirdik */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobilde görünen hamburger menü butonu */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shadow-sm lg:hidden"
                aria-label="Menüyü aç"
              >
                {/* Üç yatay çizgiden oluşan basit hamburger ikonu */}
                <span className="space-y-1">
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                </span>
              </button>

              {/* Logo / başlık alanı (sadece masaüstünde gösteriyoruz) */}
              <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold text-white shadow-sm lg:flex">
                U
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Modül
                </p>
                <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Projeler
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Kullanıcı e-postası ve oturum bilgisi */}
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-slate-400">
                  Oturum Açık
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {userEmail ?? "Kullanıcı"}
                </p>
              </div>

              {/* Çıkış Yap butonu */}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  ⎋
                </span>
                <span>Çıkış Yap</span>
              </button>
            </div>
          </header>

          {/* İçerik alanı */}
          <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {/* Sayfa başlığı ve kısa açıklama */}
              <section>
                <h2 className="text-lg font-semibold text-slate-900">
                  Proje Yönetimi
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ajansınızın projelerini ve müşteri bilgilerini merkezi bir
                  yerden yönetin.
                </p>
              </section>

              {/* Yeni Proje Oluştur formu */}
              {/* 
                - Bu formu sadece ajans çalışanları (owner, manager, videographer, graphic_designer vb.)
                  görebilsin istiyoruz.
                - Rolü "client" olan kullanıcılar (müşteriler) bu formu görmeyecek.
                - Bu ayrımı isAgencyStaff bayrağı ile yönetiyoruz.
              */}
              {isAgencyStaff && (
                <section>
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Yeni Proje Oluştur
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Müşteri markanız için yeni bir proje kaydı oluşturun.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Proje Adı */}
                    <div>
                      <label
                        htmlFor="project_name"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Proje Adı
                      </label>
                      <input
                        id="project_name"
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Örn: Kış Kampanyası"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>

                    {/* Müşteri Marka Adı */}
                    <div>
                      <label
                        htmlFor="client_name"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Müşteri Marka Adı
                      </label>
                      <input
                        id="client_name"
                        type="text"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Örn: Vita Emlak"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>

                    {/* Müşteri E-posta Adresi */}
                    <div>
                      <label
                        htmlFor="client_email"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Müşteri E-posta Adresi
                      </label>
                      <input
                        id="client_email"
                        type="email"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        placeholder="musteri@ornek.com"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Bu e-posta adresi Supabase&apos;deki{" "}
                        <span className="font-medium">client_email</span>{" "}
                        sütununa yazılır ve güvenlik (RLS) kurallarında
                        kullanılabilir.
                      </p>
                    </div>
                  </div>

                    {/* Form altı buton alanı */}
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={isCreatingProject}
                        className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                      >
                        {isCreatingProject ? "Kaydediliyor..." : "Projeyi Başlat"}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Mevcut Projeler listesi */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Mevcut Projeler
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Ajansınıza tanımlı tüm projeleri burada görebilirsiniz.
                    </p>
                  </div>
                </div>

                {isProjectsLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-sm text-slate-500">
                    Projeler yükleniyor...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Henüz sisteme eklenmiş bir proje bulunmuyor.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      İlk projenizi yukarıdaki formu kullanarak
                      oluşturabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {projects.map((project) => {
                      // Duruma göre rozet (badge) rengi ve etiket metnini belirliyoruz.
                      const status = project.status || "Aktif";
                      let statusClasses =
                        "bg-slate-50 text-slate-700 border-slate-200";

                      if (status === "Aktif") {
                        statusClasses =
                          "bg-emerald-50 text-emerald-700 border-emerald-200";
                      } else if (status === "Tamamlandı") {
                        statusClasses =
                          "bg-sky-50 text-sky-700 border-sky-200";
                      } else if (status === "Beklemede") {
                        statusClasses =
                          "bg-amber-50 text-amber-700 border-amber-200";
                      }

                      return (
                        <article
                          key={project.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100"
                        >
                          <div className="space-y-2">
                            {/* Proje adı */}
                            <h3 className="text-sm font-semibold text-slate-900">
                              {project.name}
                            </h3>

                            {/* Müşteri adı */}
                            <p className="text-xs text-slate-500">
                              Müşteri:{" "}
                              <span className="font-medium text-slate-700">
                                {project.client_name || "-"}
                              </span>
                            </p>

                            {/* Müşteri e-posta */}
                            <p className="text-xs text-slate-500">
                              Müşteri e-posta:{" "}
                              <span className="font-medium text-slate-700">
                                {project.client_email || "-"}
                              </span>
                            </p>

                            {/* Durum rozeti */}
                            <div className="mt-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses}`}
                              >
                                {status}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

