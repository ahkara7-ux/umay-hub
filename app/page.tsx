// Bu bileşeni "use client" ile işaretliyoruz çünkü Supabase oturum kontrolü,
// yönlendirme (router.push) ve buton tıklamaları gibi etkileşimler
// yalnızca tarayıcı (istemci) tarafında çalışabilir.
"use client";

// React'ten useEffect ve useState hook'larını içe aktarıyoruz.
// useState: bileşen içinde durum (state) yönetmek için
// useEffect: bileşen yüklendiğinde (veya güncellendiğinde) yan etkileri çalıştırmak için kullanılır.
import { useEffect, useState } from "react";

// Next.js App Router'da istemci tarafı yönlendirme yapmak için useRouter hook'unu içe aktarıyoruz.
import { useRouter } from "next/navigation";

// Supabase istemcisini (client) daha önce oluşturduğumuz lib/supabase.ts dosyasından alıyoruz.
import { supabase } from "@/lib/supabase";

// Merkezi Sidebar bileşenimizi içe aktarıyoruz.
// Böylece tüm sayfalarda aynı menüyü (Link + active state + RBAC) kullanacağız.
import { Sidebar } from "@/components/Sidebar";

// Recharts kütüphanesinden LineChart bileşenlerini içe aktarıyoruz.
// Bu sayede son 7 günün harcama trendini basit bir çizgi grafik olarak göstereceğiz.
// NOT: Bu grafik şu anda sahte (mock) verilerle çalışıyor, ileride gerçek Meta / Google verileri eklenecek.
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Supabase üzerindeki "integrations" tablosundaki kayıtların tipini TypeScript ile tanımlıyoruz.
// Bu tablo, ajansın hangi platformlarla (meta, google_ads, ga4) entegrasyon kurduğunu simüle eder.
type Integration = {
  id: string;
  agency_id: string | null;
  platform: "meta" | "google_ads" | "ga4";
  is_connected: boolean;
  created_at: string;
};

// Dashboard üzerinde rol ve entegrasyon kontrolü için minimum profil bilgisi tipini tanımlıyoruz.
type Profile = {
  id: string;
  email: string | null;
  role: string | null;
  agency_id: string | null;
};

// Ana dashboard bileşenini tanımlıyoruz.
// Varsayılan export olduğu için bu bileşen "/" (ana sayfa) rotasında gösterilecektir.
export default function Home() {
  // Kullanıcının oturum (session) bilgisini tutmak için bir state tanımlıyoruz.
  // Başlangıç değeri null: Yani henüz oturum bilgisi bilinmiyor.
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >["data"]["session"] | null>(null);

  // Kullanıcının e-posta adresini ayrı bir state olarak tutuyoruz.
  // Böylece header içinde kolayca gösterebiliriz.
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Oturum kontrolü sırasında kısa bir yükleniyor (loading) durumu göstermek için state tanımlıyoruz.
  // Bu sayede oturum bilgisi kontrol edilirken ekranda boşluk veya yanlış içerik görünmez.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Mobil cihazlarda sol menünün (sidebar) açılıp kapanma durumunu yönetmek için bir state tanımlıyoruz.
  // false: Menü kapalı, true: Menü açık (ekranın solundan kayan drawer olarak görünecek).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Kullanıcının profil bilgisini (RBAC ve entegrasyon kontrolü için) profiles tablosundan çekeceğiz.
  // Bu rol bilgisini Sidebar bileşenine göndererek müşteri rolünde menüyü daraltacağız.
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // Rol / profil bilgisini çekerken kısa bir yükleniyor durumu tutuyoruz.
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Ajansın herhangi bir entegrasyonu (Meta, Google Ads, GA4) bağlı mı?
  // Bu bilgiye göre dashboard'ta metrikleri mi yoksa entegrasyon uyarısını mı göstereceğiz.
  const [hasAnyIntegration, setHasAnyIntegration] = useState(false);

  // Yönlendirme işlemleri için router nesnesini alıyoruz.
  const router = useRouter();

  // Bileşen yüklendiğinde Supabase üzerinden aktif oturum var mı diye kontrol ediyoruz.
  useEffect(() => {
    // Asenkron bir fonksiyon tanımlayıp hemen çalıştırıyoruz.
    const checkSession = async () => {
      try {
        // Supabase'ten mevcut oturumu (session) istiyoruz.
        const { data, error } = await supabase.auth.getSession();

        // Eğer Supabase bir hata döndürdüyse, konsola yazıyoruz ve kullanıcıyı login sayfasına alıyoruz.
        if (error) {
          // Gerçek projede bunu daha gelişmiş bir hata yönetimi ile ele alabiliriz.
          console.error("Oturum kontrolü sırasında hata:", error.message);
          router.push("/login");
          return;
        }

        // Eğer oturum yoksa (kullanıcı giriş yapmamışsa) login sayfasına yönlendiriyoruz.
        if (!data.session) {
          router.push("/login");
          return;
        }

        // Buraya geliyorsak, aktif bir oturum var demektir; state'i güncelliyoruz.
        setSession(data.session);

        // Kullanıcının e-posta adresini session içinden alıp ayrı state'e yazıyoruz.
        const emailFromSession = data.session.user.email ?? null;
        setUserEmail(emailFromSession);
      } finally {
        // Hangi durumda olursa olsun (başarılı veya hatalı) kontrol bittiğinde
        // yükleniyor durumunu false yapıyoruz ki arayüzü gösterebilelim.
        setIsCheckingSession(false);
      }
    };

    // Tanımladığımız asenkron fonksiyonu çağırıyoruz.
    checkSession();
  }, [router]);

  // Oturum kontrolü sonrası, giriş yapan kullanıcının rolünü profiles tablosundan alıyoruz.
  // Böylece Sidebar içindeki RBAC (client rolünde bazı linkleri gizleme) doğru çalışır
  // ve aynı zamanda agency_id bilgisini alarak entegrasyon durumlarını kontrol edebiliriz.
  useEffect(() => {
    // Eğer henüz oturum veya e-posta bilgisi yoksa profil sorgusuna başlamıyoruz.
    if (!session || !userEmail) return;

    const fetchProfileAndIntegrations = async () => {
      setIsProfileLoading(true);

      try {
        // Önce kullanıcının profilini alıyoruz (role + agency_id)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, role, agency_id")
          .eq("email", userEmail)
          // .maybeSingle(): Kayıt yoksa hata fırlatmak yerine data: null döner.
          .maybeSingle();

        if (profileError) {
          console.error(
            "Kullanıcı profili alınırken hata:",
            profileError.message
          );
          setCurrentProfile(null);
          setHasAnyIntegration(false);
          // Profil alınamadıysa kullanıcıyı login sayfasına yönlendiriyoruz.
          router.push("/login");
          return;
        }

        if (!profileData) {
          console.error(
            "Kullanıcı profili bulunamadı. Lütfen destek ile iletişime geçin."
          );
          setCurrentProfile(null);
          setHasAnyIntegration(false);
          // Profil yoksa login'e yönlendirme veya ayrı bir ekrana atma tercih edilir;
          // burada /login tercih edildi.
          router.push("/login");
          return;
        }

        const profile = profileData as Profile;
        setCurrentProfile(profile);
        // Debug amaçlı: mevcut profil bilgisini konsola basıyoruz.
        // Bu sayede role ve agency_id değerlerinin doğru gelip gelmediğini görebilirsiniz.
        console.log("Dashboard currentProfile:", profile);

        // Eğer ajansa ait bir agency_id yoksa entegrasyon aramamıza gerek yok.
        if (!profile.agency_id) {
          setHasAnyIntegration(false);
          return;
        }

        // Ajansa ait entegrasyonları kontrol ediyoruz.
        // En az bir entegrasyon (meta, google_ads, ga4) bağlı mı?
        const { data: integrationsData, error: integrationsError } =
          await supabase
            .from("integrations")
            .select("id, platform, is_connected")
            .eq("agency_id", profile.agency_id)
            .eq("is_connected", true);

        if (integrationsError) {
          console.error(
            "Entegrasyon bilgileri alınırken hata:",
            integrationsError.message
          );
          setHasAnyIntegration(false);
          return;
        }

        const rows = (integrationsData as Integration[]) || [];
        setHasAnyIntegration(rows.length > 0);
      } catch (err) {
        console.error(
          "Kullanıcı profili veya entegrasyonları alınırken beklenmeyen hata:",
          err
        );
        setCurrentProfile(null);
        setHasAnyIntegration(false);
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchProfileAndIntegrations();
  }, [session, userEmail]);

  // Kullanıcı "Çıkış Yap" butonuna bastığında çalışacak fonksiyonu tanımlıyoruz.
  const handleLogout = async () => {
    try {
      // Supabase üzerinden oturumu sonlandırmak için signOut fonksiyonunu kullanıyoruz.
      const { error } = await supabase.auth.signOut();

      // Eğer bir hata dönerse konsola yazıyoruz.
      // Dilerseniz buraya da kullanıcıya gösterilecek bir Türkçe hata mesajı ekleyebiliriz.
      if (error) {
        console.error("Çıkış yapılırken bir hata oluştu:", error.message);
      }
    } finally {
      // Her durumda (hata olsa bile) kullanıcıyı login sayfasına yönlendiriyoruz.
      router.push("/login");
    }
  };

  // Eğer oturum kontrolü hala devam ediyorsa, basit bir yükleniyor ekranı gösteriyoruz.
  // Böylece kullanıcı, kontrol bitmeden dashboard içeriğini görmüyor.
  // Rol bilgisi de yükleniyorsa, yine kısa bir bekleme ekranı gösteriyoruz.
  if (isCheckingSession || isProfileLoading || !currentProfile || !currentProfile.role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        {/* Basit bir yükleniyor metni; istenirse buraya küçük bir spinner animasyonu eklenebilir */}
        Oturum kontrol ediliyor...
      </div>
    );
  }

  // Buraya kadar gelindiyse ve yönlendirme yapılmadıysa, oturum var demektir.
  // Artık dashboard içeriğini güvenle gösterebiliriz.
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Ana layout */}
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
                {/* Üç yatay çizgiden oluşan basit hamburger ikonu */}
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
                  Dashboard
                </p>
                <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                  UMAY Hub
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Kullanıcı bilgilerini ve çıkış butonunu gösteren alan */}
              <div className="hidden text-right sm:block">
                {/* Eğer e-posta bilgisi varsa gösteriyoruz, yoksa 'Oturum Açık' gibi genel bir ifade kullanıyoruz */}
                <p className="text-xs font-medium text-slate-400">
                  Oturum Açık
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {userEmail ?? "Kullanıcı"}
                </p>
              </div>

              {/* Çıkış butonu; önceki sahte profil avatarının yerini alıyor */}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                {/* Küçük bir görsel vurgu için dairesel ikon alanı */}
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  ⎋
                </span>
                <span>Çıkış Yap</span>
              </button>
            </div>
          </header>

          {/* İçerik */}
          <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
            {/* Eğer ajans için herhangi bir entegrasyon bağlı değilse */}
            {!hasAnyIntegration ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center shadow-sm shadow-slate-100">
                  {currentProfile?.role === "client" ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900">
                        Ajansınız henüz veri bağlantısı kurmadı
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Reklam verileri ajansınız tarafından UMAY Hub&apos;a
                        bağlandığında, kampanya performansınızı buradan
                        görüntüleyebileceksiniz. Lütfen ajans temsilcinizle
                        iletişime geçin.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-900">
                        Henüz bir reklam hesabı bağlamadınız
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Dijital pazarlama verilerinizi görebilmek için Meta,
                        Google Ads veya GA4 entegrasyonlarından en az birini
                        bağlamanız gerekiyor.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push("/integrations")}
                        className="mt-4 inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
                      >
                        Entegrasyonlar Sayfasına Git
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Üst kısım: Özet istatistik kartları */}
                <section>
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                    Özet Performans
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {/* Toplam Harcama */}
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        Toplam Harcama
                      </p>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="text-3xl font-semibold text-slate-900">
                          12.450 TL
                        </p>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                          Son 7 gün
                        </span>
                      </div>
                    </div>

                    {/* Toplam Erişim */}
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        Toplam Erişim
                      </p>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="text-3xl font-semibold text-slate-900">
                          85K
                        </p>
                        <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700">
                          Tüm kanallar
                        </span>
                      </div>
                    </div>

                    {/* Tıklama (Clicks) */}
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        Tıklama (Clicks)
                      </p>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="text-3xl font-semibold text-slate-900">
                          1.200
                        </p>
                        <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                          Son 7 gün
                        </span>
                      </div>
                    </div>

                    {/* Ort. Tıklama Oranı (CTR) */}
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        Ort. Tıklama Oranı (CTR)
                      </p>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="text-3xl font-semibold text-slate-900">
                          %1,4
                        </p>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                          Hedef %2,0
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Orta kısım: Harcama Grafiği (Recharts ile) */}
                <section className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                          Harcama Grafiği (Son 7 Gün)
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Bu grafik, son 7 gündeki günlük reklam harcama
                          trendini sahte (mock) verilerle simüle eder.
                        </p>
                      </div>
                    </div>

                    {/* Recharts ile çizilmiş basit bir çizgi grafik.
                        NOT: Burası geçici simülasyon kodudur, gerçek Meta / Google verileri eklenecek. */}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={[
                            { day: "Pzt", spend: 1500 },
                            { day: "Sal", spend: 1800 },
                            { day: "Çar", spend: 2100 },
                            { day: "Per", spend: 1900 },
                            { day: "Cum", spend: 2300 },
                            { day: "Cmt", spend: 2200 },
                            { day: "Paz", spend: 1650 },
                          ]}
                          margin={{ top: 10, right: 16, left: -8, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e7eb"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickFormatter={(value) => `${value / 1000}K`}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              borderColor: "#e5e7eb",
                              fontSize: 12,
                            }}
                            formatter={(value) => {
                              const num =
                                typeof value === "number" ? value : Number(value ?? 0);
                              return [
                                `${num.toLocaleString("tr-TR")} TL`,
                                "Harcama",
                              ];
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="spend"
                            stroke="#0284c7"
                            strokeWidth={2}
                            dot={{ r: 3, strokeWidth: 1, stroke: "#0ea5e9" }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Sağ tarafta özet bir kutu (örneğin son gün verisi) */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Son Gün Özeti
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Dünkü harcama ve performans verilerinin kısa özeti.
                    </p>

                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Harcama</span>
                        <span className="font-semibold text-slate-900">
                          2.300 TL
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Gösterim</span>
                        <span className="font-semibold text-slate-900">
                          14.200
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Tıklama</span>
                        <span className="font-semibold text-slate-900">
                          210
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">
                          Tıklama Oranı (CTR)
                        </span>
                        <span className="font-semibold text-slate-900">
                          %1,48
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Alt kısım: Aktif Kampanyalar listesi (mock verilerle) */}
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Aktif Kampanyalar
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Ajansınızın şu anda yayında olan veya duraklatılmış
                        örnek kampanyaları.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100">
                    <div className="hidden bg-slate-50/80 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:grid sm:grid-cols-12">
                      <div className="col-span-5">Kampanya Adı</div>
                      <div className="col-span-3">Bütçe</div>
                      <div className="col-span-2">Durum</div>
                      <div className="col-span-2 text-right">Kanal</div>
                    </div>

                    <ul className="divide-y divide-slate-100 text-sm">
                      {[
                        {
                          name: "Vita Emlak - Lead Kampanyası",
                          budget: "4.000 TL / ay",
                          status: "Aktif",
                          channel: "Meta",
                        },
                        {
                          name: "Nova Dental - Marka Arama",
                          budget: "3.500 TL / ay",
                          status: "Aktif",
                          channel: "Google Ads",
                        },
                        {
                          name: "Global Food - Remarketing",
                          budget: "2.000 TL / ay",
                          status: "Duraklatıldı",
                          channel: "Meta + Google",
                        },
                      ].map((c) => {
                        const isActive = c.status === "Aktif";
                        return (
                          <li
                            key={c.name}
                            className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-12 sm:items-center sm:px-6"
                          >
                            <div className="col-span-5">
                              <p className="font-medium text-slate-900">
                                {c.name}
                              </p>
                            </div>
                            <div className="col-span-3 text-slate-600">
                              {c.budget}
                            </div>
                            <div className="col-span-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                  isActive
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <div className="col-span-2 text-right text-xs text-slate-500">
                              {c.channel}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
