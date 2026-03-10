// Bu sayfayı "use client" ile işaretliyoruz çünkü:
// - Supabase ile oturum (auth) ve profil sorguları yapacağız,
// - Yeni ekip üyesi / müşteri ekleme formu ile Supabase'e INSERT isteği göndereceğiz,
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

// Supabase üzerindeki "profiles" tablosundaki kayıtların tipini TypeScript ile tanımlıyoruz.
// Burada tipleri olabildiğince esnek (null olabilir) bırakıyoruz ki şema değişikliklerinde sorun yaşanmasın.
// - id: Profil kaydının kimliği (genellikle auth.users.id ile eşleşir)
// - full_name: Ad Soyad bilgisi
// - email: Kullanıcının e-posta adresi
// - role: Kullanıcının sistem içindeki rolü (owner, manager, client vb.)
// - agency_id: Kullanıcının bağlı olduğu ajansın kimliği (Multi-tenant ayrımı için kritik)
// - created_at: Oluşturulma tarihi
type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  agency_id: string | null;
  created_at: string;
};

// "Ekip Yönetimi" (Ajans Ekibi ve Müşteriler) sayfasının ana bileşenini tanımlıyoruz.
// Bu dosya app/team/page.tsx olduğu için, Next.js bu bileşeni "/team" rotasında gösterecektir.
export default function TeamPage() {
  // Oturum (session) bilgisini tutmak için bir state tanımlıyoruz.
  // Başlangıç değeri null: Henüz oturum bilgisi çekilmedi anlamına geliyor.
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >["data"]["session"] | null>(null);

  // Kullanıcının e-posta bilgisini header'da göstermek için ayrı bir state kullanıyoruz.
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Oturum kontrolü yapılırken kısa süreli "yükleniyor" durumu göstermek için kullanacağımız state.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Giriş yapan kullanıcının kendi profil kaydını (profiles tablosundan) saklayacağımız state.
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // Profil bilgisi çekilirken yükleniyor durumunu takip etmek için ayrı bir state.
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Profil sorgusunda bir hata oluşursa (örneğin RLS nedeni ile erişim yoksa),
  // kullanıcıya anlamlı bir mesaj gösterebilmek için basit bir hata mesajı state'i tutuyoruz.
  const [profileErrorMessage, setProfileErrorMessage] = useState<
    string | null
  >(null);

  // Ajans ekibinde yer alan tüm profilleri (owner, manager, ekip ve müşteriler)
  // listelemek için kullanacağımız state.
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);

  // Ekip listesi Supabase'den çekilirken bir yükleniyor durumu göstermek için kullanacağımız state.
  const [isTeamLoading, setIsTeamLoading] = useState(true);

  // Yeni ekip üyesi / müşteri ekleme formundaki alanları yönetmek için state'ler:
  // Ad Soyad
  const [newFullName, setNewFullName] = useState<string>("");
  // E-posta Adresi
  const [newEmail, setNewEmail] = useState<string>("");
  // Rol Seçimi (manager, client vb.)
  const [newRole, setNewRole] = useState<string>("");

  // "Ekle" butonuna basıldığında INSERT işlemi devam ederken
  // butonu devre dışı bırakmak için kullanacağımız state.
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Mobil cihazlarda sol menünün (sidebar) açılıp kapanma durumunu yönetmek için bir state tanımlıyoruz.
  // false: Menü kapalı, true: Menü açık (ekranın solundan kayan drawer olarak görünecek).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // SAYFA 2: GİRİŞ YAPAN KULLANICININ PROFİLİNİ ÇEKME
  // Oturum kontrolü başarıyla geçildikten sonra (session dolu olduğunda),
  // Supabase'deki "profiles" tablosundan, giriş yapan kullanıcıya ait profil kaydını çekiyoruz.
  useEffect(() => {
    // Eğer henüz oturum bilgisi yoksa (örneğin kontrol devam ediyorsa),
    // profil sorgusuna başlamıyoruz.
    if (!session) return;

    const fetchCurrentProfile = async () => {
      setIsProfileLoading(true);
      setProfileErrorMessage(null);

      try {
        // Çoğu Supabase projelerinde "profiles" tablosundaki "id" kolonu,
        // auth.users tablosundaki kullanıcı id'si ile birebir eşleştirilir.
        // Bu yüzden burada id eşleştirmesi ile profil kaydını çekiyoruz.
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error(
            "Profil bilgisi alınırken bir hata oluştu:",
            error.message
          );
          setProfileErrorMessage(
            "Profil bilgileriniz alınırken bir sorun oluştu. Lütfen daha sonra tekrar deneyin."
          );
          return;
        }

        setCurrentProfile(data as Profile);
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

  // Yetki kontrolü:
  // Sadece rolü "owner" veya "manager" olan kullanıcıların bu sayfayı tam yetkiyle kullanmasını istiyoruz.
  const isAuthorized =
    currentProfile &&
    (currentProfile.role === "owner" || currentProfile.role === "manager");

  // SAYFA 3: AJANS EKİBİNİ (AYNI agency_id'YE BAĞLI PROFİLLERİ) ÇEKME
  useEffect(() => {
    // Eğer profil henüz yüklenmediyse veya kullanıcı yetkili değilse,
    // ajans ekibini sorgulamaya gerek yok.
    if (!currentProfile || !currentProfile.agency_id || !isAuthorized) return;

    const fetchTeamProfiles = async () => {
      setIsTeamLoading(true);

      try {
        // Supabase'deki "profiles" tablosundan, giriş yapan kullanıcının agency_id değerine
        // sahip tüm profilleri çekiyoruz.
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("agency_id", currentProfile.agency_id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error(
            "Ajans ekibi listesi alınırken bir hata oluştu:",
            error.message
          );
          return;
        }

        setTeamProfiles((data as Profile[]) || []);
      } catch (err) {
        console.error(
          "Ajans ekibi listesi alınırken beklenmeyen bir hata oluştu:",
          err
        );
      } finally {
        setIsTeamLoading(false);
      }
    };

    fetchTeamProfiles();
  }, [currentProfile, isAuthorized]);

  // Ajans ekibi listesini yenilemek (örneğin yeni bir ekip üyesi / müşteri oluşturulduktan sonra)
  // en güncel veriyi getirmek için kullanacağımız yardımcı fonksiyon.
  const refreshTeamProfiles = async () => {
    if (!currentProfile || !currentProfile.agency_id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("agency_id", currentProfile.agency_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "Ajans ekibi listesi yenilenirken bir hata oluştu:",
          error.message
        );
        return;
      }

      setTeamProfiles((data as Profile[]) || []);
    } catch (err) {
      console.error(
        "Ajans ekibi listesi yenilenirken beklenmeyen bir hata oluştu:",
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

  // YENİ PROFİL (EKİP ÜYESİ / MÜŞTERİ) OLUŞTURMA İŞLEMİ
  // Bu fonksiyon, formdaki "Ekle" butonuna basıldığında çalışır.
  // Formdan aldığı değerlerle Supabase'teki "profiles" tablosuna yeni bir kayıt ekler.
  const handleCreateProfile = async () => {
    // Önce basit bir doğrulama yapıyoruz: Zorunlu alanlar doldurulmuş mu?
    if (!newFullName || !newEmail || !newRole) {
      alert(
        "Lütfen Ad Soyad, E-posta Adresi ve Rol alanlarını doldurun."
      );
      return;
    }

    // E-posta formatı için çok basit bir kontrol ekleyebiliriz (isteğe bağlı).
    if (!newEmail.includes("@")) {
      alert("Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    // Geçerli bir agency_id olmadan yeni profil oluşturmak mantıklı olmaz;
    // bu yüzden önce agency_id bilgisinin mevcut olduğundan emin oluyoruz.
    if (!currentProfile || !currentProfile.agency_id) {
      alert(
        "Ajans bilgisi alınamadı. Lütfen sayfayı yenileyip tekrar deneyin."
      );
      return;
    }

    // Insert işlemi başladığı için butonu devre dışı bırakmak üzere loading durumunu true yapıyoruz.
    setIsCreatingProfile(true);

    try {
      // Supabase üzerindeki "profiles" tablosuna yeni bir satır ekliyoruz.
      // Burada:
      // - full_name: Ad Soyad
      // - email: E-posta adresi
      // - role: Rol (manager, client vb.)
      // - agency_id: Giriş yapan owner/manager'ın ajans kimliği
      const { error } = await supabase.from("profiles").insert({
        full_name: newFullName,
        email: newEmail,
        role: newRole,
        agency_id: currentProfile.agency_id,
      });

      // Eğer Supabase bir hata döndürdüyse, kullanıcıya basit bir uyarı gösteriyoruz
      // ve hatayı konsola yazıyoruz.
      if (error) {
        console.error(
          "Yeni ekip üyesi / müşteri eklenirken bir hata oluştu:",
          error.message
        );
        alert(
          "Kişi eklenirken bir hata oluştu. Lütfen tekrar deneyin veya sistem yöneticinize haber verin."
        );
        return;
      }

      // Ekleme işlemi başarılıysa, form alanlarını temizliyoruz.
      setNewFullName("");
      setNewEmail("");
      setNewRole("");

      // Ardından ekip listesini yeniliyoruz ki yeni eklenen kişi hemen ekranda görünsün.
      await refreshTeamProfiles();
    } catch (err) {
      console.error(
        "Yeni ekip üyesi / müşteri eklenirken beklenmeyen bir hata oluştu:",
        err
      );
      alert(
        "Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin."
      );
    } finally {
      // Hangi durumda olursa olsun, işlem bittiğinde loading durumunu false yapıyoruz.
      setIsCreatingProfile(false);
    }
  };

  // Eğer oturum kontrolü veya profil bilgisi yüklemesi hala devam ediyorsa,
  // basit bir yükleniyor ekranı gösteriyoruz.
  if (isCheckingSession || isProfileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Oturum ve profil bilgileriniz yükleniyor...
      </div>
    );
  }

  // Eğer profil sorgusunda hata aldıysak veya profil kaydı bulunamadıysa,
  // kullanıcıya anlaşılır bir mesaj gösteriyoruz.
  if (!currentProfile || profileErrorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center text-sm text-slate-600 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-100 max-w-md">
          <p className="font-semibold text-slate-900 mb-1">
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

  // Eğer kullanıcının rolü owner veya manager değilse, yetki uyarısı gösteriyoruz.
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center text-sm text-slate-600 px-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm shadow-amber-100 max-w-md">
          <p className="font-semibold text-amber-900 mb-1">
            Bu sayfayı görüntüleme yetkiniz yok
          </p>
          <p className="text-xs text-amber-700">
            Sadece ajans sahibi (owner) ve ajans yöneticisi (manager) bu sayfaya
            erişebilir. Eğer bunun bir hata olduğunu düşünüyorsanız, ajans
            yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  // Buraya gelindiyse:
  // - Oturum ve profil yüklemesi tamamlanmış,
  // - Kullanıcının rolü owner veya manager olarak doğrulanmış demektir.
  // Artık Ekip Yönetimi arayüzünü gösterebiliriz.
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
                  Ajans Ekibi ve Müşteriler
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
                  Ekip Yönetimi
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ajansınızın iç ekibini ve müşterilerini aynı yerden yönetin.
                </p>
              </section>

              {/* Yeni Ekip Üyesi veya Müşteri Ekle formu */}
              <section>
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Yeni Ekip Üyesi veya Müşteri Ekle
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Ajansınızın operasyonlarını yürütecek ekip arkadaşlarınızı
                      veya müşterilerinizi bu alan üzerinden ekleyebilirsiniz.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Ad Soyad */}
                    <div>
                      <label
                        htmlFor="full_name"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Ad Soyad
                      </label>
                      <input
                        id="full_name"
                        type="text"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        placeholder="Örn: Elif Kaya"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>

                    {/* E-posta Adresi */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-xs font-medium text-slate-700"
                      >
                        E-posta Adresi
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="kisi@ornek.com"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>

                    {/* Rol Seçimi */}
                    <div>
                      <label
                        htmlFor="role"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Rol Seçimi
                      </label>
                      <select
                        id="role"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="">
                          Bir rol seçin (zorunlu)
                        </option>
                        <option value="manager">Ajans Yöneticisi</option>
                        <option value="videographer">Videographer</option>
                        <option value="graphic_designer">Grafiker</option>
                        <option value="developer">Yazılımcı</option>
                        <option value="content_creator">
                          İçerik Üreticisi
                        </option>
                        <option value="social_media_manager">
                          Sosyal Medya Yöneticisi
                        </option>
                        <option value="client">Müşteri</option>
                      </select>
                    </div>
                  </div>

                  {/* Form altı buton alanı */}
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateProfile}
                      disabled={isCreatingProfile}
                      className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                    >
                      {isCreatingProfile ? "Ekleniyor..." : "Ekle"}
                    </button>
                  </div>
                </div>
              </section>

              {/* Ajans Ekibi ve Müşteriler listesi */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Ajans Ekibi ve Müşteriler
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Aynı ajansa bağlı tüm kullanıcıları (owner, manager, ekip
                      ve müşteriler) burada görebilirsiniz.
                    </p>
                  </div>
                </div>

                {isTeamLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-sm text-slate-500">
                    Ekip verileri yükleniyor...
                  </div>
                ) : teamProfiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Henüz ajansınıza bağlı bir ekip üyesi veya müşteri
                      bulunmuyor.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      İlk kişiyi yukarıdaki formu kullanarak ekleyebilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {teamProfiles.map((profile) => {
                      // Role göre rozet (badge) rengi ve etiket metnini belirliyoruz.
                      const role = profile.role ?? "client";
                      let roleLabel = role;
                      let roleClasses =
                        "bg-slate-50 text-slate-700 border-slate-200";

                      if (role === "owner") {
                        roleLabel = "Ajans Sahibi";
                        roleClasses =
                          "bg-purple-50 text-purple-700 border-purple-200";
                      } else if (role === "manager") {
                        roleLabel = "Ajans Yöneticisi";
                        roleClasses =
                          "bg-emerald-50 text-emerald-700 border-emerald-200";
                      } else if (role === "videographer") {
                        roleLabel = "Videographer";
                        roleClasses =
                          "bg-sky-50 text-sky-700 border-sky-200";
                      } else if (role === "graphic_designer") {
                        roleLabel = "Grafiker";
                        roleClasses =
                          "bg-pink-50 text-pink-700 border-pink-200";
                      } else if (role === "developer") {
                        roleLabel = "Yazılımcı";
                        roleClasses =
                          "bg-indigo-50 text-indigo-700 border-indigo-200";
                      } else if (role === "content_creator") {
                        roleLabel = "İçerik Üreticisi";
                        roleClasses =
                          "bg-amber-50 text-amber-700 border-amber-200";
                      } else if (role === "social_media_manager") {
                        roleLabel = "Sosyal Medya Yöneticisi";
                        roleClasses =
                          "bg-cyan-50 text-cyan-700 border-cyan-200";
                      } else if (role === "client") {
                        roleLabel = "Müşteri";
                        roleClasses =
                          "bg-slate-50 text-slate-700 border-slate-200";
                      }

                      return (
                        <article
                          key={profile.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100"
                        >
                          <div className="space-y-2">
                            {/* Ad Soyad veya e-posta (eğer ad yoksa) */}
                            <h3 className="text-sm font-semibold text-slate-900">
                              {profile.full_name || profile.email || "Bilinmeyen Kullanıcı"}
                            </h3>

                            {/* E-posta */}
                            <p className="text-xs text-slate-500">
                              E-posta:{" "}
                              <span className="font-medium text-slate-700">
                                {profile.email || "-"}
                              </span>
                            </p>

                            {/* Rol rozeti */}
                            <div className="mt-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleClasses}`}
                              >
                                {roleLabel}
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

