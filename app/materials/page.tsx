// Bu sayfayı "use client" ile işaretliyoruz çünkü:
// - Supabase ile oturum (auth) kontrolü yapacağız,
// - Materyal listesi için veritabanından veri çekeceğiz,
// - "Onayla" ve "Revize İste" butonlarına tıklayınca Supabase'e güncelleme isteği göndereceğiz,
// - Yönlendirme (router.push) işlemleri için tarayıcı tarafında çalışmamız gerekiyor.
"use client";

// React'ten useEffect ve useState hook'larını içe aktarıyoruz.
// useState: bileşen içinde durum (state) yönetmek için kullanılır.
// useEffect: bileşen yüklendiğinde veya belirli bir state/prop değiştiğinde yan etkileri (fetch, update vb.) çalıştırmak için kullanılır.
import { useEffect, useState } from "react";

// Next.js App Router'da istemci tarafı yönlendirme yapmak için useRouter hook'unu kullanıyoruz.
// Örneğin: başarılı çıkıştan sonra "/login" sayfasına yönlendirmek için.
import { useRouter } from "next/navigation";

// Supabase istemcisini, daha önce oluşturduğumuz lib/supabase.ts dosyasından içe aktarıyoruz.
// Bu istemci sayesinde Supabase veritabanına sorgu atabileceğiz.
import { supabase } from "@/lib/supabase";

// Supabase üzerindeki "materials" tablosundaki kayıtların tipini TypeScript ile tanımlıyoruz.
// Burada tablo sütunlarını basitçe modellemek yeterli:
// - id: Her materyalin benzersiz kimliği (primary key)
// - file_name: Dosya adı (Örn: Ağustos_Reels_V1.mp4)
// - type: Materyal tipi (Örn: "Video", "Görsel", "PDF")
// - status: Materyalin durumu (Örn: "Onay Bekliyor", "Onaylandı", "Revize İstendi")
// - created_at: Son aktiviteleri sıralarken ihtiyaç duyabileceğimiz tarih bilgisi
type Material = {
  id: string;
  file_name: string; // Orijinal dosya adı (örn: Ağustos_Reels_V1.mp4)
  file_url?: string; // Supabase Storage üzerinde oluşturulan herkese açık dosya linki
  type: string; // Materyal türü (Video, Tasarım, Metin vb.)
  status: string; // Onay durumu (Onay Bekliyor, Onaylandı, Revize İstendi)
  created_at: string; // Oluşturulma tarihi
};

// Supabase üzerindeki "projects" tablosundaki kayıtların tipini tanımlıyoruz.
// Bu sayfada sadece id ve name alanlarına ihtiyaç duyacağız.
type Project = {
  id: string;
  name: string;
};

// "Materyal Onay Merkezi" sayfasının ana bileşenini tanımlıyoruz.
// Bu dosya app/materials/page.tsx olduğu için, Next.js bu bileşeni "/materials" rotasında gösterecektir.
export default function MaterialsPage() {
  // Oturum (session) bilgisini tutmak için bir state tanımlıyoruz.
  // Başlangıç değeri null: Henüz oturum bilgisi çekilmedi anlamına geliyor.
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >["data"]["session"] | null>(null);

  // Kullanıcının e-posta bilgisini header'da göstermek için ayrı bir state kullanıyoruz.
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Oturum kontrolü yapılırken kısa süreli "yükleniyor" durumu göstermek için kullanacağımız state.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Materials (Materyaller) listesini tutmak için bir dizi state tanımlıyoruz.
  const [materials, setMaterials] = useState<Material[]>([]);

  // Materyal verileri Supabase'den çekilirken bir yükleniyor durumu göstermek için kullanacağımız state.
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true);

  // Herhangi bir materyal için "Onayla" veya "Revize İste" butonuna basıldığında
  // o materyalin id'sini burada saklayarak sadece ilgili kartın butonlarını devre dışı bırakacağız.
  const [updatingMaterialId, setUpdatingMaterialId] = useState<string | null>(
    null
  );

  // Mobil cihazlarda sol menünün (sidebar) açılıp kapanma durumunu yönetmek için bir state tanımlıyoruz.
  // false: Menü kapalı, true: Menü açık (ekranın solundan kayan drawer olarak görünecek).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Geçici rol kontrolü için basit bir admin bayrağı oluşturuyoruz.
  // Burada sadece belirli bir e-posta adresine (örneğin ajans yetkilisinin maili)
  // sahip kullanıcıları "admin" olarak kabul ediyoruz.
  // Diğer tüm kullanıcılar (müşteriler) bu koşula girmeyeceği için bazı alanları göremeyecek.
  const isAdmin = userEmail === "testmail@gmail.com";

  // Proje listesini (id ve name) saklamak için bir state tanımlıyoruz.
  // Bu veriyi Supabase'teki "projects" tablosundan çekeceğiz.
  const [projects, setProjects] = useState<Project[]>([]);

  // Yeni materyal ekleme formunda seçili olan projenin id bilgisini tutuyoruz.
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Yeni materyal ekleme formunda seçilen gerçek dosya bilgisini (File nesnesi) tutuyoruz.
  // Bu dosyayı Supabase Storage'a yükleyeceğiz.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Yeni materyal ekleme formunda seçilen materyal türünü tutuyoruz.
  // Varsayılan olarak boş bırakıyoruz; kullanıcı seçince güncellenecek.
  const [newMaterialType, setNewMaterialType] = useState<string>("");

  // "Sisteme Yükle" butonuna basıldığında insert işlemi devam ederken
  // butonu devre dışı bırakmak için kullanacağımız state.
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);

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

  // SAYFA 2: MATERYAL LİSTESİNİ SUPABASE'DEN ÇEKME
  // Oturum kontrolü başarıyla geçildikten sonra (session dolu olduğunda),
  // Supabase'deki "materials" tablosundan verileri çekiyoruz.
  useEffect(() => {
    // Eğer henüz oturum bilgisi yoksa (örneğin kontrol devam ediyorsa),
    // verileri çekmeye başlamıyoruz.
    if (!session) return;

    // Asenkron veri çekme fonksiyonumuzu tanımlıyoruz.
    const fetchMaterials = async () => {
      // Veri çekme başlarken yükleniyor durumunu true yapıyoruz.
      setIsMaterialsLoading(true);

      try {
        // Supabase'deki "materials" tablosundan tüm satırları çekiyoruz.
        // order("created_at", { ascending: false }): En yeni kayıt en üstte olacak şekilde sıralar.
        const { data, error } = await supabase
          .from("materials")
          .select("*")
          .order("created_at", { ascending: false });

        // Eğer Supabase bir hata döndürdüyse, bunu konsola yazıyoruz.
        // Dilerseniz burada kullanıcıya görsel bir hata mesajı da gösterebiliriz.
        if (error) {
          console.error(
            "Materyal listesi alınırken bir hata oluştu:",
            error.message
          );
          return;
        }

        // Hata yoksa, dönen veriyi (data) state'e yazıyoruz.
        // data dizisini Material[] tipine cast ediyoruz.
        setMaterials((data as Material[]) || []);
      } catch (err) {
        // Beklenmeyen bir hata durumunda (örneğin ağ kopması) basit bir log yazıyoruz.
        console.error(
          "Materyal listesi alınırken beklenmeyen bir hata oluştu:",
          err
        );
      } finally {
        // Hangi durumda olursa olsun, veri çekme işlemi bittiğinde yükleniyor durumunu false yapıyoruz.
        setIsMaterialsLoading(false);
      }
    };

    // Tanımladığımız veri çekme fonksiyonunu çağırıyoruz.
    fetchMaterials();
  }, [session]);

  // SAYFA 3: PROJE LİSTESİNİ SUPABASE'DEN ÇEKME
  // Oturum kontrolü geçildikten sonra, "projects" tablosundan sadece id ve name alanlarını çekiyoruz.
  // Bu veriyi, "Yeni Materyal Ekle" formundaki proje seçim kutusunda (select) kullanacağız.
  useEffect(() => {
    if (!session) return;

    const fetchProjects = async () => {
      try {
        // Supabase'teki "projects" tablosundan sadece id ve name sütunlarını çekiyoruz.
        // order("name", { ascending: true }): Proje adlarını alfabetik sıralamak için.
        const { data, error } = await supabase
          .from("projects")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) {
          console.error(
            "Proje listesi alınırken bir hata oluştu:",
            error.message
          );
          return;
        }

        setProjects((data as Project[]) || []);
      } catch (err) {
        console.error(
          "Proje listesi alınırken beklenmeyen bir hata oluştu:",
          err
        );
      }
    };

    fetchProjects();
  }, [session]);

  // Materyal listesini yenilemek (örneğin bir kayıt "Onayla" veya "Revize İste"
  // işlemi sonrası güncellendikten sonra) için kullanacağımız yardımcı fonksiyon.
  const refreshMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "Materyal listesi yenilenirken bir hata oluştu:",
          error.message
        );
        return;
      }

      setMaterials((data as Material[]) || []);
    } catch (err) {
      console.error(
        "Materyal listesi yenilenirken beklenmeyen bir hata oluştu:",
        err
      );
    }
  };

  // YENİ MATERYAL EKLEME İŞLEMİ
  // Bu fonksiyon, formdaki "Sisteme Yükle" butonuna basıldığında çalışır.
  // Formdan aldığı değerlerle Supabase'teki "materials" tablosuna yeni bir kayıt ekler.
  const handleCreateMaterial = async () => {
    // Önce basit bir doğrulama yapıyoruz: Tüm alanlar doldurulmuş mu ve dosya seçilmiş mi?
    if (!selectedProjectId || !selectedFile || !newMaterialType) {
      alert(
        "Lütfen bir proje seçin, bir dosya yükleyin ve materyal türünü belirleyin."
      );
      return;
    }

    // Insert işlemi başladığı için butonu devre dışı bırakmak üzere loading durumunu true yapıyoruz.
    setIsCreatingMaterial(true);

    try {
      // 1) Supabase Storage'a dosyayı yüklemek için benzersiz bir yol (path) oluşturuyoruz.
      // Çakışmayı önlemek adına dosya adının başına Date.now() ile alınan zaman damgasını ekliyoruz.
      const originalFileName = selectedFile.name;
      const uniquePath = `${Date.now()}_${originalFileName}`;

      // 2) Supabase Storage üzerinde "materials" isimli bucket'a dosya yükleme isteği gönderiyoruz.
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("materials")
        .upload(uniquePath, selectedFile, {
          // İçerik tipini (MIME type) dosyanın tipinden otomatik alıyoruz.
          contentType: selectedFile.type || "application/octet-stream",
        });

      // Eğer upload sırasında hata oluşursa kullanıcıyı bilgilendiriyoruz.
      if (uploadError || !uploadData) {
        console.error(
          "Dosya Supabase Storage'a yüklenirken bir hata oluştu:",
          uploadError?.message
        );
        alert(
          "Dosya yüklenirken bir hata oluştu. Lütfen tekrar deneyin veya sistem yöneticinize haber verin."
        );
        return;
      }

      // 3) Dosya başarıyla yüklendiyse, Supabase Storage üzerinden herkese açık erişim linkini alıyoruz.
      const {
        data: publicUrlData,
      } = supabase.storage.from("materials").getPublicUrl(uploadData.path);

      const fileUrl = publicUrlData.publicUrl;

      // 4) Artık "materials" tablosuna yeni bir satır ekleyebiliriz.
      // - file_name: Orijinal dosya adı (kullanıcıya okunabilir göstermek için)
      // - file_url: Supabase Storage tarafından sağlanan herkese açık dosya bağlantısı
      const { error: insertError } = await supabase.from("materials").insert({
        project_id: selectedProjectId,
        file_name: originalFileName,
        file_url: fileUrl,
        type: newMaterialType,
        status: "Onay Bekliyor",
      });

      // Eğer Supabase insert aşamasında bir hata döndürürse kullanıcıyı bilgilendiriyoruz.
      if (insertError) {
        console.error(
          "Yeni materyal veritabanına eklenirken bir hata oluştu:",
          insertError.message
        );
        alert(
          "Materyal veritabanına eklenirken bir hata oluştu. Lütfen tekrar deneyin veya sistem yöneticinize haber verin."
        );
        return;
      }

      // Her şey yolunda gittiyse, form alanlarını temizliyoruz.
      setSelectedProjectId("");
      setSelectedFile(null);
      setNewMaterialType("");

      // Ardından materyal listesini yeniliyoruz ki yeni eklenen kayıt hemen ekranda görünsün.
      await refreshMaterials();
    } catch (err) {
      console.error(
        "Yeni materyal eklenirken beklenmeyen bir hata oluştu:",
        err
      );
      alert(
        "Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin."
      );
    } finally {
      // Hangi durumda olursa olsun, işlem bittiğinde loading durumunu false yapıyoruz.
      setIsCreatingMaterial(false);
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

  // Bir materyalin durumunu Supabase üzerinde güncellemek için ortak bir yardımcı fonksiyon tanımlıyoruz.
  // materialId: Güncellemek istediğimiz materyalin benzersiz id değeri.
  // newStatus: Materyalin alacağı yeni durum (Örn: "Onaylandı" veya "Revize İstendi").
  const updateMaterialStatus = async (materialId: string, newStatus: string) => {
    // Öncelikle güncellenen materyalin id'sini state'e yazıyoruz.
    // Böylece sadece o karta ait butonları devre dışı bırakabiliriz.
    setUpdatingMaterialId(materialId);

    try {
      // Supabase üzerindeki "materials" tablosunda ilgili kaydı bulmak için id kolonuna göre filtreliyoruz.
      // update({ status: newStatus }): status sütununu yeni durum ile günceller.
      const { error } = await supabase
        .from("materials")
        .update({ status: newStatus })
        .eq("id", materialId);

      // Eğer bir hata dönerse, bunu konsola yazıyoruz.
      if (error) {
        console.error(
          "Materyal durumu güncellenirken bir hata oluştu:",
          error.message
        );
        return;
      }

      // Güncelleme işlemi başarılı ise, en güncel veriyi görmek için materyal listesini tekrar çekiyoruz.
      await refreshMaterials();
    } catch (err) {
      console.error(
        "Materyal durumu güncellenirken beklenmeyen bir hata oluştu:",
        err
      );
    } finally {
      // İşlem bittiğinde (başarılı veya hatalı) güncellenen materyal id'sini sıfırlıyoruz.
      setUpdatingMaterialId(null);
    }
  };

  // Eğer oturum kontrolü hala devam ediyorsa, basit bir yükleniyor ekranı gösteriyoruz.
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Oturum kontrol ediliyor...
      </div>
    );
  }

  // Buraya gelindiyse ve yönlendirme yapılmadıysa, aktif bir oturum vardır.
  // Artık Materyal Onay Merkezi arayüzünü gösterebiliriz.
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Ana layout: Sol tarafta sabit sidebar, sağ tarafta içerik alanı */}
      <div className="relative mx-auto flex min-h-screen max-w-7xl">
        {/* Sidebar (Sol Menü) - Ana sayfadaki tasarımın mobil uyumlu versiyonu */}
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
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
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
              className="flex items-center gap-3 rounded-lg bg-sky-50 px-3 py-2 text-sky-700 shadow-sm ring-1 ring-sky-100"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-xs font-semibold text-sky-700">
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
          {/* Header - Ana sayfadaki header'ın aynısını kullanıyoruz, sadece başlığı değiştirdik */}
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
                  Materyal Onay Merkezi
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
                  Materyal Onay Merkezi
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ajans ekibinizin yüklediği tüm materyalleri buradan
                  görüntüleyebilir, onaylayabilir veya revize talep
                  edebilirsiniz.
                </p>
              </section>

              {/* Yeni Materyal Ekle formu */}
              {/* 
                - Bu formu sadece belirlediğimiz admin e-posta adresine sahip kullanıcılar görebilsin istiyoruz.
                - isAdmin false olduğunda (müşteri rolü) bu kart tamamen gizlenecek.
              */}
              {isAdmin && (
                <section>
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Yeni Materyal Ekle
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Bir projeye bağlı yeni bir materyali sisteme ekleyin.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Proje Seçimi */}
                      <div>
                        <label
                          htmlFor="project"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Proje Seçin
                        </label>
                        <select
                          id="project"
                          value={selectedProjectId}
                          onChange={(e) =>
                            setSelectedProjectId(e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="">
                            Bir proje seçin (zorunlu)
                          </option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dosya Yükleme */}
                      <div>
                        <label
                          htmlFor="file_input"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Dosya Yükle
                        </label>
                        {/* type="file" input'u ile kullanıcının bilgisayarından dosya seçmesini sağlıyoruz. */}
                        <input
                          id="file_input"
                          type="file"
                          // Sadece bir dosya seçilmesine izin veriyoruz (multiple kullanmıyoruz).
                          onChange={(e) =>
                            setSelectedFile(
                              e.target.files && e.target.files[0]
                                ? e.target.files[0]
                                : null
                            )
                          }
                          className="mt-1 block w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-700"
                        />
                        {/* Seçilen dosyanın adını küçük bir bilgi satırı olarak gösterebiliriz. */}
                        {selectedFile && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Seçilen dosya:{" "}
                            <span className="font-medium">
                              {selectedFile.name}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Materyal Türü */}
                      <div>
                        <label
                          htmlFor="material_type"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Materyal Türü
                        </label>
                        <select
                          id="material_type"
                          value={newMaterialType}
                          onChange={(e) => setNewMaterialType(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="">
                            Bir materyal türü seçin (zorunlu)
                          </option>
                          <option value="Video">Video</option>
                          <option value="Tasarım">Tasarım</option>
                          <option value="Metin">Metin</option>
                        </select>
                      </div>
                    </div>

                    {/* Form altı buton alanı */}
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCreateMaterial}
                        disabled={isCreatingMaterial}
                        className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                      >
                        {isCreatingMaterial ? "Yükleniyor..." : "Sisteme Yükle"}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Materyal kartları listesi */}
              <section>
                {/* Yükleniyor durumu */}
                {isMaterialsLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-sm text-slate-500">
                    Materyaller yükleniyor...
                  </div>
                ) : materials.length === 0 ? (
                  // Eğer hiç materyal yoksa kullanıcıya bilgilendirici bir boş durum kartı gösteriyoruz.
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Henüz sisteme yüklenmiş bir materyal bulunmuyor.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      İlk materyaller eklendiğinde, onay sürecini buradan
                      yönetebileceksiniz.
                    </p>
                  </div>
                ) : (
                  // Materyaller varsa, her birini modern kartlar şeklinde listeliyoruz.
                  <div className="grid gap-4 lg:grid-cols-2">
                    {materials.map((material) => {
                      // Duruma göre rozet (badge) rengi ve etiket metnini belirliyoruz.
                      let statusColorClasses =
                        "bg-slate-100 text-slate-700 border-slate-200";

                      if (material.status === "Onay Bekliyor") {
                        statusColorClasses =
                          "bg-amber-50 text-amber-700 border-amber-200";
                      } else if (material.status === "Onaylandı") {
                        statusColorClasses =
                          "bg-emerald-50 text-emerald-700 border-emerald-200";
                      } else if (material.status === "Revize İstendi") {
                        statusColorClasses =
                          "bg-rose-50 text-rose-700 border-rose-200";
                      }

                      // İlgili materyal için butonlar şu anda güncelleme yapıyorsa,
                      // butonları devre dışı bırakmak için bir boolean hesaplıyoruz.
                      const isUpdating = updatingMaterialId === material.id;

                      return (
                        <article
                          key={material.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100"
                        >
                          <div className="space-y-2">
                            {/* Dosya adı */}
                            <h3 className="text-sm font-semibold text-slate-900">
                              {material.file_name}
                            </h3>

                            {/* Materyal tipi */}
                            <p className="text-xs text-slate-500">
                              Materyal tipi:{" "}
                              <span className="font-medium text-slate-700">
                                {material.type}
                              </span>
                            </p>

                            {/* Durum rozeti */}
                            <div className="mt-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColorClasses}`}
                              >
                                {material.status}
                              </span>
                            </div>

                          {/* Eğer materyalin file_url bilgisi varsa, dosyayı gör / indir linki gösteriyoruz. */}
                          {material.file_url && (
                            <div className="mt-3">
                              <a
                                href={material.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-[11px] font-medium text-sky-700 hover:text-sky-800"
                              >
                                Dosyayı Gör
                              </a>
                            </div>
                          )}
                          </div>

                          {/* Alt kısım: Onayla / Revize İste butonları */}
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex gap-2">
                              {/* Onayla butonu */}
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  updateMaterialStatus(
                                    material.id,
                                    "Onaylandı"
                                  )
                                }
                                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                              >
                                Onayla
                              </button>

                              {/* Revize İste butonu */}
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  updateMaterialStatus(
                                    material.id,
                                    "Revize İstendi"
                                  )
                                }
                                className="inline-flex items-center rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
                              >
                                Revize İste
                              </button>
                            </div>

                            {/* Güncelleme sırasında küçük bir bilgi metni */}
                            {isUpdating && (
                              <p className="text-[11px] text-slate-400">
                                Güncelleniyor...
                              </p>
                            )}
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

