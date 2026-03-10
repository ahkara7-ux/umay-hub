// Bu sayfayı "use client" ile işaretliyoruz çünkü:
// - Supabase ile oturum (auth) ve profil sorguları yapacağız,
// - RBAC (rol bazlı yetki) kontrolü yapacağız,
// - Sidebar için mobil aç/kapa state'i yöneteceğiz,
// - Butonlara onClick ile alert vereceğiz.
"use client";

// React'ten useEffect ve useState hook'larını içe aktarıyoruz.
// useState: bileşen içinde durum (state) yönetmek için kullanılır.
// useEffect: bileşen yüklendiğinde veya belirli bir state/prop değiştiğinde yan etkileri (fetch vb.) çalıştırmak için kullanılır.
import { useEffect, useState } from "react";

// Next.js App Router'da istemci tarafı yönlendirme yapmak için useRouter hook'unu kullanıyoruz.
// Örneğin: başarılı çıkıştan sonra "/login" sayfasına yönlendirmek için.
import { useRouter } from "next/navigation";

// Supabase istemcisini, daha önce oluşturduğumuz lib/supabase.ts dosyasından içe aktarıyoruz.
// Bu istemci sayesinde Supabase Auth ve veritabanı (profiles) sorgularını yapacağız.
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

// Supabase üzerindeki "integrations" tablosundaki kayıtların tipini TypeScript ile tanımlıyoruz.
// Bu tablo, her ajans ve platform için (meta, google_ads, ga4) entegrasyon durumunu simüle etmek için kullanılıyor.
// NOT: Burası geçici simülasyon tablosudur, ileride gerçek OAuth bağlantı bilgileri (token vb.) eklenecektir.
type Integration = {
  id: string;
  agency_id: string | null;
  platform: "meta" | "google_ads" | "ga4";
  is_connected: boolean;
  created_at: string;
};

// "Entegrasyonlar" sayfasının ana bileşenini tanımlıyoruz.
// Bu dosya app/integrations/page.tsx olduğu için, Next.js bu bileşeni "/integrations" rotasında gösterecektir.
export default function IntegrationsPage() {
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

  // Mobil cihazlarda sol menünün (sidebar) açılıp kapanma durumunu yönetmek için bir state tanımlıyoruz.
  // false: Menü kapalı, true: Menü açık (ekranın solundan kayan drawer olarak görünecek).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Entegrasyon durumlarını (meta, google_ads, ga4 için bağlı / bağlı değil) tutacağımız state.
  // Örnek yapı: { meta: true, google_ads: false, ga4: true }
  const [integrationStates, setIntegrationStates] = useState<{
    meta: boolean;
    google_ads: boolean;
    ga4: boolean;
  }>({
    meta: false,
    google_ads: false,
    ga4: false,
  });

  // Her bir entegrasyon kartının kendi yükleniyor (loading) durumunu takip etmek için state.
  // Örnek yapı: { meta: false, google_ads: true, ga4: false }
  const [integrationLoading, setIntegrationLoading] = useState<{
    meta: boolean;
    google_ads: boolean;
    ga4: boolean;
  }>({
    meta: false,
    google_ads: false,
    ga4: false,
  });

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

  // SAYFA 3: AJANSA AİT ENTEGRASYON DURUMLARINI ÇEKME
  // Profil yüklendikten sonra, ilgili agency_id için "integrations" tablosundaki
  // kayıtları çekiyoruz ve hangi platformun bağlı olduğunu state'e yazıyoruz.
  // NOT: Burası geçici simülasyon kodudur, gerçek OAuth bağlantıları eklendiğinde
  // bu tablo yerine gerçek bağlantı durumları kullanılacaktır.
  useEffect(() => {
    if (!currentProfile || !currentProfile.agency_id) return;

    const fetchIntegrations = async () => {
      try {
        const { data, error } = await supabase
          .from("integrations")
          .select("*")
          .eq("agency_id", currentProfile.agency_id);

        if (error) {
          console.error(
            "Entegrasyon durumları alınırken bir hata oluştu:",
            error.message
          );
          return;
        }

        const rows = (data as Integration[]) || [];

        // Varsayılan tüm platformları false kabul edip, gelen kayıtlara göre güncelliyoruz.
        const nextStates = {
          meta: false,
          google_ads: false,
          ga4: false,
        } as { meta: boolean; google_ads: boolean; ga4: boolean };

        for (const row of rows) {
          if (row.platform === "meta") {
            nextStates.meta = row.is_connected;
          } else if (row.platform === "google_ads") {
            nextStates.google_ads = row.is_connected;
          } else if (row.platform === "ga4") {
            nextStates.ga4 = row.is_connected;
          }
        }

        setIntegrationStates(nextStates);
      } catch (err) {
        console.error(
          "Entegrasyon durumları alınırken beklenmeyen bir hata oluştu:",
          err
        );
      }
    };

    fetchIntegrations();
  }, [currentProfile]);

  // Yetki kontrolü:
  // Sadece rolü "owner" veya "manager" olan kullanıcıların bu sayfayı tam yetkiyle kullanmasını istiyoruz.
  // Diğer roller (özellikle "client") için tam ekran uyarı göstereceğiz.
  const isAuthorized =
    currentProfile &&
    (currentProfile.role === "owner" || currentProfile.role === "manager");

  // TEK YERDEN ENTEGRASYON DURUMUNU DEĞİŞTİREN YARDIMCI FONKSİYON
  // platform: "meta" | "google_ads" | "ga4"
  // targetConnected: true ise bağla, false ise bağlantıyı kes.
  const handleToggleIntegration = async (
    platform: "meta" | "google_ads" | "ga4",
    targetConnected: boolean
  ) => {
    // Geçerli ajans bilgisi yoksa entegrasyon kaydı yapmak mantıklı olmaz.
    if (!currentProfile || !currentProfile.agency_id) {
      alert(
        "Ajans bilgisi alınamadı. Lütfen sayfayı yenileyip tekrar deneyin."
      );
      return;
    }

    // İlgili platform için loading durumunu true yapıyoruz.
    setIntegrationLoading((prev) => ({
      ...prev,
      [platform]: true,
    }));

    try {
      if (targetConnected) {
        // BAĞLAMA (CONNECT) İŞLEMİ
        // integrations tablosuna ilgili platform için kayıt ekliyor veya güncelliyoruz.
        // NOT: Burası geçici simülasyon kodudur, gerçek OAuth bağlantısı eklendiğinde
        // burada access token vb. bilgiler tutulacak.
        const { error } = await supabase
          .from("integrations")
          .upsert(
            {
              agency_id: currentProfile.agency_id,
              platform,
              is_connected: true,
            },
            // onConflict ile aynı agency_id + platform için tek kayıt kalmasını sağlıyoruz.
            { onConflict: "agency_id,platform" }
          );

        if (error) {
          console.error(
            "Entegrasyon bağlanırken bir hata oluştu:",
            error.message
          );
          alert(
            "Entegrasyon bağlanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
          );
          return;
        }
      } else {
        // BAĞLANTIYI KESME (DISCONNECT) İŞLEMİ
        // İki basit yaklaşım var:
        // 1) Kaydı silmek
        // 2) is_connected değerini false yapmak
        // Burada simülasyon amaçlı olarak is_connected alanını false'a çekiyoruz.
        const { error } = await supabase
          .from("integrations")
          .update({ is_connected: false })
          .eq("agency_id", currentProfile.agency_id)
          .eq("platform", platform);

        if (error) {
          console.error(
            "Entegrasyon bağlantısı kesilirken bir hata oluştu:",
            error.message
          );
          alert(
            "Entegrasyon bağlantısı kesilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
          );
          return;
        }
      }

      // Lokal state'i güncelliyoruz ki UI anında yenilensin.
      setIntegrationStates((prev) => ({
        ...prev,
        [platform]: targetConnected,
      }));
    } catch (err) {
      console.error(
        "Entegrasyon simülasyonu sırasında beklenmeyen bir hata oluştu:",
        err
      );
      alert(
        "Entegrasyon simülasyonu sırasında beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin."
      );
    } finally {
      // Loading durumunu kapatıyoruz.
      setIntegrationLoading((prev) => ({
        ...prev,
        [platform]: false,
      }));
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

  // Eğer kullanıcının rolü owner veya manager değilse (özellikle client ise),
  // tam ekran ortasında yetki uyarısı gösteriyoruz.
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center text-sm text-slate-600 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm shadow-amber-100">
          <p className="mb-1 font-semibold text-amber-900">
            Bu sayfayı görüntüleme yetkiniz yok
          </p>
          <p className="text-xs text-amber-700">
            Entegrasyonlar sayfası sadece ajans sahibi (owner) ve ajans
            yöneticisi (manager) için görünür. Eğer bunun bir hata olduğunu
            düşünüyorsanız, ajans yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  // Buraya gelindiyse:
  // - Oturum ve profil yüklemesi tamamlanmış,
  // - Kullanıcının rolü owner veya manager olarak doğrulanmış demektir.
  // Artık Entegrasyonlar arayüzünü gösterebiliriz.
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
                  Entegrasyonlar
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
                  Dijital Pazarlama Entegrasyonları
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Meta, Google Ads ve Google Analytics 4 hesaplarınızı bağlayarak
                  kampanya performanslarınızı UMAY Hub üzerinden tek ekranda
                  görüntüleyin.
                </p>
              </section>

              {/* Entegrasyon kartları grid'i */}
              <section>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Meta Reklamları Kartı */}
                  <article className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <div className="space-y-3">
                      {/* Basit Meta (Facebook & Instagram) ikon alanı */}
                      <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
                          M
                        </div>
                        <span className="text-xs font-semibold text-sky-800">
                          Meta Reklamları
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Meta Reklamları (Facebook &amp; Instagram)
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Facebook ve Instagram reklam kampanyalarınızın anlık
                          harcama, gösterim ve dönüşüm verilerini UMAY Hub&apos;a
                          aktarın.
                        </p>
                      </div>

                      {/* Durum rozeti */}
                      <div className="mt-1">
                        {integrationStates.meta ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            Bağlandı
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            Bağlı Değil
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alt kısım: Bağla butonu */}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleIntegration(
                            "meta",
                            !integrationStates.meta
                          )
                        }
                        disabled={integrationLoading.meta}
                        className={
                          integrationStates.meta
                            ? "inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                            : "inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                        }
                      >
                        {/* Burası geçici simülasyon kodudur, gerçek OAuth eklenecek */}
                        {integrationLoading.meta
                          ? integrationStates.meta
                            ? "Bağlantı Kesiliyor..."
                            : "Bağlanıyor..."
                          : integrationStates.meta
                          ? "Bağlantıyı Kes"
                          : "Bağla"}
                      </button>
                    </div>
                  </article>

                  {/* Google Ads Kartı */}
                  <article className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <div className="space-y-3">
                      {/* Basit Google Ads ikon alanı */}
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-semibold text-white">
                          G
                        </div>
                        <span className="text-xs font-semibold text-amber-800">
                          Google Ads
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Google Ads
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Arama ve görüntülü reklam kampanyalarınızın harcama ve
                          dönüşüm verilerini otomatik olarak içeri aktarın.
                        </p>
                      </div>

                      {/* Durum rozeti */}
                      <div className="mt-1">
                        {integrationStates.google_ads ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            Bağlandı
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            Bağlı Değil
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alt kısım: Bağla / Bağlantıyı Kes butonu */}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleIntegration(
                            "google_ads",
                            !integrationStates.google_ads
                          )
                        }
                        disabled={integrationLoading.google_ads}
                        className={
                          integrationStates.google_ads
                            ? "inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                            : "inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                        }
                      >
                        {/* Burası geçici simülasyon kodudur, gerçek OAuth eklenecek */}
                        {integrationLoading.google_ads
                          ? integrationStates.google_ads
                            ? "Bağlantı Kesiliyor..."
                            : "Bağlanıyor..."
                          : integrationStates.google_ads
                          ? "Bağlantıyı Kes"
                          : "Bağla"}
                      </button>
                    </div>
                  </article>

                  {/* Google Analytics 4 (GA4) Kartı */}
                  <article className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <div className="space-y-3">
                      {/* Basit GA4 ikon alanı */}
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
                          A
                        </div>
                        <span className="text-xs font-semibold text-emerald-800">
                          Google Analytics 4
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Google Analytics 4 (GA4)
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Web sitesi ve uygulama trafiğini, dönüşüm hunilerini ve
                          kullanıcı davranışlarını UMAY Hub panelinize taşıyın.
                        </p>
                      </div>

                      {/* Durum rozeti */}
                      <div className="mt-1">
                        {integrationStates.ga4 ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            Bağlandı
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            Bağlı Değil
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alt kısım: Bağla / Bağlantıyı Kes butonu */}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleIntegration("ga4", !integrationStates.ga4)
                        }
                        disabled={integrationLoading.ga4}
                        className={
                          integrationStates.ga4
                            ? "inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                            : "inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                        }
                      >
                        {/* Burası geçici simülasyon kodudur, gerçek OAuth eklenecek */}
                        {integrationLoading.ga4
                          ? integrationStates.ga4
                            ? "Bağlantı Kesiliyor..."
                            : "Bağlanıyor..."
                          : integrationStates.ga4
                          ? "Bağlantıyı Kes"
                          : "Bağla"}
                      </button>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

