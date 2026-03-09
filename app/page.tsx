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

  // Dashboard içeriğinde göstereceğimiz istatistikler için ayrı state'ler tanımlıyoruz.
  // projectsCount: Supabase'deki "projects" tablosundan gelen toplam proje sayısı.
  const [projectsCount, setProjectsCount] = useState<number | null>(null);

  // pendingMaterialsCount: Supabase'deki "materials" tablosunda durumu "Onay Bekliyor"
  // olan materyallerin sayısı.
  const [pendingMaterialsCount, setPendingMaterialsCount] = useState<
    number | null
  >(null);

  // Son aktiviteler bölümünde göstermek üzere, en son eklenen projenin adı için bir state tanımlıyoruz.
  // Örn: "Yeni proje eklendi: [Proje Adı]" metnini buradan üreteceğiz.
  const [latestProjectName, setLatestProjectName] = useState<string | null>(
    null
  );

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

  // Oturum kontrolü başarılı olduktan sonra, Supabase'den dashboard için ihtiyaç duyduğumuz
  // istatistik verilerini çekmek üzere ikinci bir useEffect tanımlıyoruz.
  useEffect(() => {
    // Eğer henüz session bilgisi yoksa (örneğin kontrol devam ediyorsa),
    // verileri çekmeye başlamıyoruz. Böylece gereksiz istek atmamış oluruz.
    if (!session) return;

    // Asenkron veri çekme fonksiyonumuzu tanımlıyoruz.
    const fetchDashboardData = async () => {
      try {
        // 1) "projects" tablosundaki toplam proje sayısını çekiyoruz.
        // Supabase'te sayım (count) almak için select içinde "*" kullanıp
        // ikinci parametre olarak { count: "exact", head: true } opsiyonlarını veriyoruz.
        const { count: projectsTotal, error: projectsError } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true });

        // Eğer bir hata dönerse, konsola yazıyoruz.
        if (projectsError) {
          console.error(
            "Projeler sayısı alınırken hata oluştu:",
            projectsError.message
          );
        } else {
          // Hata yoksa, dönen count değerini state'e yazıyoruz.
          setProjectsCount(projectsTotal ?? 0);
        }

        // 2) "materials" tablosunda durumu "Onay Bekliyor" olan kayıtların sayısını çekiyoruz.
        const {
          count: materialsPendingTotal,
          error: materialsError,
        } = await supabase
          .from("materials")
          .select("*", { count: "exact", head: true })
          .eq("status", "Onay Bekliyor");

        if (materialsError) {
          console.error(
            "Bekleyen materyal sayısı alınırken hata oluştu:",
            materialsError.message
          );
        } else {
          setPendingMaterialsCount(materialsPendingTotal ?? 0);
        }

        // 3) "projects" tablosundan en son eklenen projeyi çekiyoruz.
        // order("created_at", { ascending: false }): En yeni kayıt en üstte olacak şekilde sıralar.
        // limit(1): Sadece 1 kayıt alırız.
        const {
          data: latestProjects,
          error: latestProjectError,
        } = await supabase
          .from("projects")
          .select("name")
          .order("created_at", { ascending: false })
          .limit(1);

        if (latestProjectError) {
          console.error(
            "Son proje bilgisi alınırken hata oluştu:",
            latestProjectError.message
          );
        } else if (latestProjects && latestProjects.length > 0) {
          // Dönen ilk (ve tek) kaydın adını state'e yazıyoruz.
          setLatestProjectName(latestProjects[0].name as string);
        } else {
          // Eğer hiç proje yoksa, bunu da kullanıcıya bilgi olarak gösterebiliriz.
          setLatestProjectName(null);
        }
      } catch (error) {
        // Beklenmeyen bir hata durumunda (örneğin ağ hatası) konsola basit bir log yazıyoruz.
        console.error("Dashboard verileri alınırken beklenmeyen hata:", error);
      }
    };

    // Tanımladığımız veri çekme fonksiyonunu çağırıyoruz.
    fetchDashboardData();
  }, [session]);

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
  if (isCheckingSession) {
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
        {/* Sidebar (Sol Menü) */}
        {/* 
          - Mobilde: fixed + translate-x ile ekranın solundan kayan bir drawer olarak davranır.
          - Masaüstünde (lg ve üstü): static konumda, her zamanki sabit sol menü görünümünü korur.
        */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 border-r border-slate-200 bg-white/90 px-6 py-8 shadow-lg transition-transform duration-200 ease-out
          ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:static lg:inset-auto lg:translate-x-0 lg:bg-white/80 lg:shadow-sm`}
        >
          <div className="mb-10">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold text-white shadow-sm">
                U
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Ajans Paneli
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  UMAY Hub
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 text-sm font-medium">
            <a
              href="/"
              // Mobilde menüden bir linke basıldığında drawer'ın kapanması için onClick ile state'i kapatıyoruz.
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg bg-sky-50 px-3 py-2 text-sky-700 shadow-sm ring-1 ring-sky-100"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-xs font-semibold text-sky-700">
                ●
              </span>
              <span>Dashboard</span>
            </a>
            <a
              href="#"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                PR
              </span>
              <span>Projeler</span>
            </a>
            <a
              href="#"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                GÖ
              </span>
              <span>Görevler</span>
            </a>
            <a
              href="/materials"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                MO
              </span>
              <span>Materyal Onayı</span>
            </a>
            <a
              href="#"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                MŞ
              </span>
              <span>Müşteriler</span>
            </a>
            <a
              href="#"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                AY
              </span>
              <span>Ayarlar</span>
            </a>
          </nav>
        </aside>

        {/* Mobilde sidebar açıkken arka planda görünen yarı saydam karartma (overlay) alanı */}
        {/* 
          - Sadece küçük ekranlarda (lg altı) ve sidebar açıksa gösterilir.
          - Kullanıcı bu karanlık alana tıkladığında menüyü kapatıyoruz.
        */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

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
            <div className="space-y-8">
              {/* İstatistik kartları */}
              <section>
                <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                  Genel Görünüm
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {/* Aktif Projeler */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      Aktif Projeler
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      {/* Eğer Supabase'ten gelen proje sayısı henüz yüklenmediyse '...' gösteriyoruz */}
                      <p className="text-3xl font-semibold text-slate-900">
                        {projectsCount === null ? "..." : projectsCount}
                      </p>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        +2 bu hafta
                      </span>
                    </div>
                  </div>

                  {/* Bekleyen Onaylar */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      Bekleyen Onaylar
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      {/* Eğer Supabase'ten gelen bekleyen onay sayısı henüz yüklenmediyse '...' gösteriyoruz */}
                      <p className="text-3xl font-semibold text-slate-900">
                        {pendingMaterialsCount === null
                          ? "..."
                          : pendingMaterialsCount}
                      </p>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        Öncelikli
                      </span>
                    </div>
                  </div>

                  {/* Tamamlanan İşler */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      Tamamlanan İşler
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-3xl font-semibold text-slate-900">
                        0
                      </p>
                      <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                        Son 30 gün
                      </span>
                    </div>
                  </div>

                  {/* Yeni Mesajlar */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      Yeni Mesajlar
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-3xl font-semibold text-slate-900">
                        0
                      </p>
                      <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                        Müşteri kutusu
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Son Aktiviteler */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                      Son Aktiviteler
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Ekibinizin ve müşterilerinizin son hareketlerini buradan
                      takip edin.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100">
                  <div className="hidden bg-slate-50/80 px-6 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 sm:grid sm:grid-cols-12">
                    <div className="col-span-5">Aktivite</div>
                    <div className="col-span-3">Proje</div>
                    <div className="col-span-2">Sorumlu</div>
                    <div className="col-span-2 text-right">Zaman</div>
                  </div>

                  <ul className="divide-y divide-slate-100">
                    <li className="grid grid-cols-1 gap-2 px-4 py-4 text-sm sm:grid-cols-12 sm:items-center sm:px-6">
                      <div className="col-span-5">
                        {/* Supabase'ten gelen en son proje ismini burada gösteriyoruz.
                            Eğer henüz veri yoksa, kullanıcıya bilgi vermek için basit bir metin yazıyoruz. */}
                        <p className="font-medium text-slate-900">
                          {latestProjectName
                            ? `Yeni proje eklendi: ${latestProjectName}`
                            : "Henüz eklenmiş bir proje bulunmuyor."}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Supabase veritabanındaki projeler tablosundan alınan
                          son kayıt.
                        </p>
                      </div>
                      <div className="col-span-3 text-slate-600">
                        Projeler
                      </div>
                      <div className="col-span-2 text-slate-600">
                        Sistem
                      </div>
                      <div className="col-span-2 text-right text-xs text-slate-500">
                        Şimdi
                      </div>
                    </li>

                    <li className="grid grid-cols-1 gap-2 px-4 py-4 text-sm sm:grid-cols-12 sm:items-center sm:px-6">
                      <div className="col-span-5">
                        <p className="font-medium text-slate-900">
                          Yeni kampanya onaylandı
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Instagram performans kampanyası müşteri tarafından
                          onaylandı.
                        </p>
                      </div>
                      <div className="col-span-3 text-slate-600">
                        Nova Dental Dijital Kampanya
                      </div>
                      <div className="col-span-2 text-slate-600">
                        Murat A.
                      </div>
                      <div className="col-span-2 text-right text-xs text-slate-500">
                        1 saat önce
                      </div>
                    </li>

                    <li className="grid grid-cols-1 gap-2 px-4 py-4 text-sm sm:grid-cols-12 sm:items-center sm:px-6">
                      <div className="col-span-5">
                        <p className="font-medium text-slate-900">
                          İçerik takvimi güncellendi
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Mayıs ayı sosyal medya içerikleri revize edildi.
                        </p>
                      </div>
                      <div className="col-span-3 text-slate-600">
                        Ayın İçerikleri - Global Food
                      </div>
                      <div className="col-span-2 text-slate-600">
                        Duygu S.
                      </div>
                      <div className="col-span-2 text-right text-xs text-slate-500">
                        Dün
                      </div>
                    </li>

                    <li className="grid grid-cols-1 gap-2 px-4 py-4 text-sm sm:grid-cols-12 sm:items-center sm:px-6">
                      <div className="col-span-5">
                        <p className="font-medium text-slate-900">
                          Rapor paylaşıldı
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Nisan performans raporu müşteri ile paylaşıldı.
                        </p>
                      </div>
                      <div className="col-span-3 text-slate-600">
                        Q2 Performans Raporu
                      </div>
                      <div className="col-span-2 text-slate-600">
                        Berke T.
                      </div>
                      <div className="col-span-2 text-right text-xs text-slate-500">
                        3 gün önce
                      </div>
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
