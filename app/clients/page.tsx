// Bu sayfayı "use client" ile işaretliyoruz çünkü:
// - Supabase ile oturum (auth) ve profil sorguları yapacağız,
// - Yeni müşteri oluştururken Supabase Auth (signUp) + profiles INSERT işlemlerini yapacağız,
// - RBAC (sadece owner / manager erişebilsin) kontrolü uygulayacağız,
// - Sidebar için mobil aç/kapa state'ini yöneteceğiz.
"use client";

// React'ten useEffect ve useState hook'larını içe aktarıyoruz.
// useState: bileşen içinde durum (state) yönetmek için kullanılır.
// useEffect: bileşen yüklendiğinde veya belirli bir state/prop değiştiğinde yan etkileri (fetch, insert vb.) çalıştırmak için kullanılır.
import { useEffect, useState } from "react";

// Next.js App Router'da istemci tarafı yönlendirme yapmak için useRouter hook'unu kullanıyoruz.
// Örneğin: başarılı çıkıştan sonra "/login" sayfasına yönlendirmek için.
import { useRouter } from "next/navigation";

// Supabase istemcisini, daha önce oluşturduğumuz lib/supabase.ts dosyasından içe aktarıyoruz.
// Bu istemci sayesinde Supabase Auth ve veritabanı (profiles) işlemlerini yapacağız.
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

// "Müşteri Yönetimi" sayfasının ana bileşenini tanımlıyoruz.
// Bu dosya app/clients/page.tsx olduğu için, Next.js bu bileşeni "/clients" rotasında gösterecektir.
export default function ClientsPage() {
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

  // Ajansa bağlı tüm müşteri profillerini (role: client) listelemek için kullanacağımız state.
  const [clients, setClients] = useState<Profile[]>([]);

  // Müşteri listesi Supabase'den çekilirken bir yükleniyor durumu göstermek için kullanacağımız state.
  const [isClientsLoading, setIsClientsLoading] = useState(true);

  // Yeni müşteri oluşturma formundaki alanları yönetmek için state'ler:
  // Ad Soyad
  const [newFullName, setNewFullName] = useState<string>("");
  // E-posta Adresi
  const [newEmail, setNewEmail] = useState<string>("");
  // Şifre (opsiyonel) – Eğer boş bırakılırsa bizim oluşturacağımız geçici şifre kullanılacak.
  const [newPassword, setNewPassword] = useState<string>("");

  // "Müşteri Ekle" butonuna basıldığında INSERT (ve Auth signUp) işlemi devam ederken
  // butonu devre dışı bırakmak için kullanacağımız state.
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Müşteri ekleme formunun açık/kapalı durumunu yönetmek için basit bir state.
  const [isFormOpen, setIsFormOpen] = useState(false);

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
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          // .maybeSingle(): Kayıt yoksa hata fırlatmak yerine data: null döner.
          .maybeSingle();

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

        if (!data) {
          console.error(
            "Profil kaydınız bulunamadı. Lütfen destek ekibiyle iletişime geçin."
          );
          setProfileErrorMessage(
            "Profil kaydınız bulunamadı. Lütfen destek ekibiyle iletişime geçin."
          );
          return;
        }

        setCurrentProfile(data as Profile);
        // Debug: Mevcut profil bilgilerini konsola basıyoruz.
        console.log("ClientsPage currentProfile:", data);
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
  // Sadece rolü "owner" veya "manager" olan kullanıcıların bu sayfayı kullanmasını istiyoruz.
  const isAuthorized =
    currentProfile &&
    (currentProfile.role === "owner" || currentProfile.role === "manager");

  // SAYFA 3: AJANSA BAĞLI MÜŞTERİLERİ (ROLE: CLIENT) ÇEKME
  useEffect(() => {
    if (!currentProfile || !currentProfile.agency_id || !isAuthorized) return;

    const fetchClients = async () => {
      setIsClientsLoading(true);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("agency_id", currentProfile.agency_id)
          .eq("role", "client")
          .order("created_at", { ascending: false });

        if (error) {
          console.error(
            "Müşteri listesi alınırken bir hata oluştu:",
            error.message
          );
          return;
        }

        setClients((data as Profile[]) || []);
      } catch (err) {
        console.error(
          "Müşteri listesi alınırken beklenmeyen bir hata oluştu:",
          err
        );
      } finally {
        setIsClientsLoading(false);
      }
    };

    fetchClients();
  }, [currentProfile, isAuthorized]);

  // Müşteri listesini yenilemek (yeni müşteri eklendikten sonra en güncel veriyi almak) için
  // kullanacağımız yardımcı fonksiyon.
  const refreshClients = async () => {
    if (!currentProfile || !currentProfile.agency_id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("agency_id", currentProfile.agency_id)
        .eq("role", "client")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "Müşteri listesi yenilenirken bir hata oluştu:",
          error.message
        );
        return;
      }

      setClients((data as Profile[]) || []);
    } catch (err) {
      console.error(
        "Müşteri listesi yenilenirken beklenmeyen bir hata oluştu:",
        err
      );
    }
  };

  // KULLANICI "ÇIKIŞ YAP" BUTONUNA BASTIĞINDA ÇALIŞACAK FONKSİYON
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Çıkış yapılırken bir hata oluştu:", error.message);
      }
    } finally {
      router.push("/login");
    }
  };

  // Yeni müşteri için geçici şifre üreten basit fonksiyon.
  // NOT: Burası geçici bir çözümdür; gerçek hayatta daha güvenli bir şifre üretimi ve
  // şifreyi müşteriye iletme (mail vb.) mekanizması kurulmalıdır.
  const generateTemporaryPassword = (length = 10) => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // YENİ MÜŞTERİ OLUŞTURMA İŞLEMİ
  // Bu fonksiyon, formdaki "Müşteriyi Ekle" butonuna basıldığında çalışır.
  // 1) Supabase Auth ile kullanıcıyı oluşturur (signUp),
  // 2) profiles tablosuna role: 'client' ve agency_id ile kayıt ekler.
  const handleCreateClient = async () => {
    // Önce basit bir doğrulama yapıyoruz: Zorunlu alanlar doldurulmuş mu?
    if (!newFullName || !newEmail) {
      alert("Lütfen İsim ve E-posta alanlarını doldurun.");
      return;
    }

    if (!newEmail.includes("@")) {
      alert("Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    if (!currentProfile || !currentProfile.agency_id) {
      alert(
        "Ajans bilgisi alınamadı. Lütfen sayfayı yenileyip tekrar deneyin."
      );
      return;
    }

    setIsCreatingClient(true);

    try {
      // 1) Supabase Auth ile yeni kullanıcı oluşturuyoruz.
      // Eğer şifre girilmişse onu, girilmemişse geçici bir şifre üretiyoruz.
      const finalPassword =
        newPassword && newPassword.length >= 6
          ? newPassword
          : generateTemporaryPassword(10);

      const {
        data: signUpData,
        error: signUpError,
      } = await supabase.auth.signUp({
        email: newEmail,
        password: finalPassword,
      });

      if (signUpError || !signUpData.user) {
        console.error(
          "Müşteri kullanıcı oluşturulurken bir hata oluştu:",
          signUpError?.message
        );
        alert(
          "Müşteri için kullanıcı oluşturulurken bir hata oluştu. Lütfen e-posta adresinin daha önce kullanılmadığından emin olun."
        );
        return;
      }

      const userId = signUpData.user.id;

      // 2) profiles tablosuna müşteri profilini ekliyoruz.
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          full_name: newFullName,
          email: newEmail,
          role: "client",
          agency_id: currentProfile.agency_id,
        });

      if (profileInsertError) {
        console.error(
          "Müşteri profili oluşturulurken bir hata oluştu:",
          profileInsertError.message
        );
        alert(
          "Müşteri profili oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
        );
        return;
      }

      // Geçici şifre kullandıysak, ajans sahibine bilgi amaçlı bir alert gösterebiliriz.
      if (!newPassword || newPassword.length < 6) {
        alert(
          `Müşteri başarıyla oluşturuldu.\nGeçici şifre: ${finalPassword}\nLütfen bu bilgiyi güvenli bir şekilde müşterinizle paylaşın.`
        );
      } else {
        alert("Müşteri başarıyla oluşturuldu.");
      }

      // Form alanlarını temizliyoruz.
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setIsFormOpen(false);

      // Müşteri listesini yeniliyoruz.
      await refreshClients();
    } catch (err) {
      console.error(
        "Müşteri oluşturma sırasında beklenmeyen bir hata oluştu:",
        err
      );
      alert(
        "Müşteri oluşturma sırasında beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin."
      );
    } finally {
      setIsCreatingClient(false);
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

  // Eğer kullanıcının rolü owner veya manager değilse, yetki uyarısı gösteriyoruz.
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center text-sm text-slate-600 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm shadow-amber-100">
          <p className="mb-1 font-semibold text-amber-900">
            Bu sayfayı görüntüleme yetkiniz yok
          </p>
          <p className="text-xs text-amber-700">
            Sadece ajans sahibi (owner) ve ajans yöneticisi (manager) müşteri
            yönetimi sayfasına erişebilir. Eğer bunun bir hata olduğunu
            düşünüyorsanız, ajans yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  // Buraya gelindiyse:
  // - Oturum ve profil yüklemesi tamamlanmış,
  // - Kullanıcının rolü owner veya manager olarak doğrulanmış demektir.
  // Artık Müşteri Yönetimi arayüzünü gösterebiliriz.
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
          role={currentProfile.role}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Sağ ana bölüm */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobilde görünen hamburger menü butonu */}
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

              {/* Logo / başlık alanı */}
              <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold text-white shadow-sm lg:flex">
                U
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Modül
                </p>
                <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Müşteri Yönetimi
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
              {/* Sayfa başlığı ve açıklama */}
              <section className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Ajans Müşterileri
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Ajansınıza bağlı tüm marka/müşteri hesaplarını buradan
                    yönetebilirsiniz.
                  </p>
                </div>

                {/* Müşteri Ekle butonu */}
                <button
                  type="button"
                  onClick={() => setIsFormOpen((open) => !open)}
                  className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  {isFormOpen ? "Formu Kapat" : "Müşteri Ekle"}
                </button>
              </section>

              {/* Müşteri Ekle formu (açılır / kapanır kart) */}
              {isFormOpen && (
                <section>
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Yeni Müşteri Ekle
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Müşteri için bir kullanıcı hesabı ve profil kaydı
                        oluşturulur. İsterseniz kendi belirlediğiniz bir şifre
                        girebilir veya sistemin üreteceği geçici şifreyi
                        kullanabilirsiniz.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Ad Soyad */}
                      <div>
                        <label
                          htmlFor="client_full_name"
                          className="block text-xs font-medium text-slate-700"
                        >
                          İsim Soyisim
                        </label>
                        <input
                          id="client_full_name"
                          type="text"
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                          placeholder="Örn: Vita Emlak"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        />
                      </div>

                      {/* E-posta Adresi */}
                      <div>
                        <label
                          htmlFor="client_email"
                          className="block text-xs font-medium text-slate-700"
                        >
                          E-posta Adresi
                        </label>
                        <input
                          id="client_email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="musteri@ornek.com"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        />
                      </div>

                      {/* Şifre (opsiyonel) */}
                      <div>
                        <label
                          htmlFor="client_password"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Şifre (opsiyonel)
                        </label>
                        <input
                          id="client_password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Boş bırakırsanız sistem geçici bir şifre üretir"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Geçici şifre üretildiğinde ekrana gösterilir ve
                          müşterinizle paylaşmanız beklenir.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCreateClient}
                        disabled={isCreatingClient}
                        className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                      >
                        {isCreatingClient ? "Müşteri Ekleniyor..." : "Müşteriyi Ekle"}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Mevcut müşteriler listesi */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Mevcut Müşteriler
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Ajansınıza bağlı, role: client olarak işaretlenmiş tüm
                      müşteri profilleri.
                    </p>
                  </div>
                </div>

                {isClientsLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-sm text-slate-500">
                    Müşteriler yükleniyor...
                  </div>
                ) : clients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Henüz ajansınıza bağlı bir müşteri bulunmuyor.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      İlk müşterinizi yukarıdaki &quot;Müşteri Ekle&quot;
                      butonunu kullanarak ekleyebilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100">
                    <div className="hidden bg-slate-50/80 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:grid sm:grid-cols-12">
                      <div className="col-span-4">Müşteri Adı</div>
                      <div className="col-span-4">E-posta</div>
                      <div className="col-span-2">Rol</div>
                      <div className="col-span-2 text-right">Oluşturulma</div>
                    </div>

                    <ul className="divide-y divide-slate-100 text-sm">
                      {clients.map((client) => (
                        <li
                          key={client.id}
                          className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-12 sm:items-center sm:px-6"
                        >
                          <div className="col-span-4">
                            <p className="font-medium text-slate-900">
                              {client.full_name || client.email || "Bilinmeyen Müşteri"}
                            </p>
                          </div>
                          <div className="col-span-4 text-slate-600">
                            {client.email ?? "-"}
                          </div>
                          <div className="col-span-2">
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                              Müşteri
                            </span>
                          </div>
                          <div className="col-span-2 text-right text-xs text-slate-500">
                            {client.created_at
                              ? new Date(client.created_at).toLocaleDateString(
                                  "tr-TR"
                                )
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
    </div>
  );
}

