// Bu sayfayı "use client" ile işaretliyoruz çünkü:
// - Supabase ile kullanıcı oluşturma (signUp) ve veritabanı INSERT işlemlerini
//   tarayıcı tarafında tetikleyeceğiz,
// - Form alanlarını (input) yönetmek için useState kullanacağız,
// - Başarılı kurulum sonrası router.push ile yönlendirme yapacağız.
"use client";

// React'ten useState ve FormEvent tipini içe aktarıyoruz.
// useState: Form alanlarını ve yükleniyor durumunu yönetmek için kullanılır.
import { useState, FormEvent } from "react";

// Next.js App Router'da istemci tarafı yönlendirme yapmak için useRouter hook'unu kullanıyoruz.
import { useRouter } from "next/navigation";

// Supabase istemcisini, daha önce oluşturduğumuz lib/supabase.ts dosyasından içe aktarıyoruz.
// Bu istemci sayesinde Supabase Auth ve veritabanı (agencies, profiles) işlemlerini yapacağız.
import { supabase } from "@/lib/supabase";

// Ajans kayıt (onboarding) sayfasının ana bileşenini tanımlıyoruz.
// Bu dosya app/register-agency/page.tsx olduğu için, Next.js bu bileşeni
// "/register-agency" rotasında gösterecektir.
export default function RegisterAgencyPage() {
  // Form alanları için state tanımları:
  // Ajans Adı
  const [agencyName, setAgencyName] = useState("");

  // Kullanıcı Ad Soyad
  const [fullName, setFullName] = useState("");

  // Kullanıcı E-posta Adresi
  const [email, setEmail] = useState("");

  // Kullanıcı Şifresi
  const [password, setPassword] = useState("");

  // "Ajansımı Kur ve Başla" butonuna basıldığında çok adımlı bir işlem başlayacak.
  // Bu işlem devam ederken butonu devre dışı bırakmak ve kullanıcıya geri bildirim
  // vermek için bir yükleniyor (loading) state'i tanımlıyoruz.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Yönlendirme (başarılı kurulum sonrası /projects sayfasına gitmek) için router nesnesini alıyoruz.
  const router = useRouter();

  // Form gönderildiğinde çalışacak ana fonksiyon.
  // Burada 3 aşamalı bir kayıt akışı uygulayacağız:
  // 1) Supabase Auth ile kullanıcıyı oluşturma
  // 2) agencies tablosuna yeni ajansı ekleme
  // 3) profiles tablosuna ajans sahibi (owner) profilini ekleme
  const handleSubmit = async (event: FormEvent) => {
    // Formun varsayılan gönderim davranışını (sayfa yenileme) engelliyoruz.
    event.preventDefault();

    // Öncelikle temel doğrulamalar:
    // - Tüm alanlar doldurulmuş mu?
    if (!agencyName || !fullName || !email || !password) {
      alert("Lütfen tüm alanları doldurun.");
      return;
    }

    // - Şifre en az 6 karakter mi?
    if (password.length < 6) {
      alert("Şifreniz en az 6 karakter olmalıdır.");
      return;
    }

    // - E-posta basit bir şekilde geçerli formatta mı? (Çok basit bir kontrol)
    if (!email.includes("@")) {
      alert("Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    // Çok adımlı işlem başladığı için loading durumunu true yapıyoruz.
    setIsSubmitting(true);

    try {
      // AŞAMA 1: Supabase Auth ile kullanıcıyı oluşturma
      // -----------------------------------------------
      // signUp çağrısında email ve password bilgilerini gönderiyoruz.
      const {
        data: signUpData,
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
      });

      // Eğer Auth aşamasında bir hata oluşursa kullanıcıyı bilgilendirip akışı kesiyoruz.
      if (signUpError || !signUpData.user) {
        console.error(
          "Kullanıcı oluşturulurken bir hata oluştu:",
          signUpError?.message
        );
        alert(
          "Kullanıcı oluşturulurken bir hata oluştu. Lütfen e-posta adresinizin daha önce kullanılmadığından emin olun veya daha sonra tekrar deneyin."
        );
        return;
      }

      // Auth üzerinden başarıyla kullanıcı oluşturulduysa, dönen user nesnesinden id bilgisini alıyoruz.
      // Bu id, genellikle profiles tablosundaki id kolonu ile birebir eşleşir.
      const userId = signUpData.user.id;

      // AŞAMA 2: agencies tablosuna yeni ajansı ekleme
      // ----------------------------------------------
      // Ajans adını agencies tablosuna ekleyip, oluşan yeni kaydın id bilgisini almak istiyoruz.
      // insert sonrasında select().single() kullanarak eklenen ajansa ait tam satırı geri alıyoruz.
      const {
        data: agencyInsertData,
        error: agencyInsertError,
      } = await supabase
        .from("agencies")
        .insert({ name: agencyName })
        .select()
        .single();

      // Eğer ajans kaydı eklenirken bir hata oluşursa kullanıcıya bilgi veriyoruz.
      if (agencyInsertError || !agencyInsertData) {
        console.error(
          "Ajans oluşturulurken bir hata oluştu:",
          agencyInsertError?.message
        );
        alert(
          "Ajans oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin veya destek ekibimizle iletişime geçin."
        );
        return;
      }

      // Yeni oluşturulan ajans kaydının id bilgisini alıyoruz.
      const agencyId = agencyInsertData.id as string;

      // AŞAMA 3: profiles tablosuna ajans sahibi (owner) profilini ekleme
      // -----------------------------------------------------------------
      // Artık elimizde hem kullanıcı id'si (userId) hem de ajans id'si (agencyId) var.
      // Bu bilgileri kullanarak profiles tablosuna bir kayıt ekleyeceğiz:
      // - id: Auth'tan gelen userId (profil ile auth.users eşleşmesi için)
      // - agency_id: Bir önceki adımda oluşturulan ajansın id'si
      // - full_name: Formdan gelen Ad Soyad
      // - email: Formdan gelen e-posta
      // - role: 'owner' (ajans sahibi)
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          agency_id: agencyId,
          full_name: fullName,
          email,
          role: "owner",
        });

      // Eğer profil kaydı eklenirken bir hata oluşursa kullanıcıya bilgi veriyoruz.
      if (profileInsertError) {
        console.error(
          "Profil oluşturulurken bir hata oluştu:",
          profileInsertError.message
        );
        alert(
          "Profil oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin veya destek ekibimizle iletişime geçin."
        );
        return;
      }

      // 3 aşamalı kayıt sürecinin tamamı başarıyla bittiyse:
      // Kullanıcıyı doğrudan Projeler sayfasına yönlendiriyoruz.
      router.push("/projects");
    } catch (error) {
      // Beklenmeyen bir hata (örneğin ağ kesintisi) oluşursa,
      // konsola detay yazıp kullanıcıya basit ve anlaşılır bir mesaj gösteriyoruz.
      console.error(
        "Ajans kayıt sürecinde beklenmeyen bir hata oluştu:",
        error
      );
      alert(
        "Ajans kayıt sürecinde beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin."
      );
    } finally {
      // İşlem hangi adımda biterse bitsin, yükleniyor durumunu false yapıyoruz.
      setIsSubmitting(false);
    }
  };

  // Bileşenin JSX ile ekran çıktısını tanımlıyoruz.
  // Burada sidebar veya header kullanmıyoruz; sade bir landing / kayıt sayfası tasarlıyoruz.
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      {/* Ortadaki ana kart */}
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60">
          {/* Başlık alanı */}
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-slate-900">
              UMAY Hub - Ajansını Kur
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Dakikalar içinde kendi dijital pazarlama ajans panelini oluştur
              ve ekibinle çalışmaya başla.
            </p>
          </div>

          {/* Kayıt formu */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Ajans Adı */}
            <div>
              <label
                htmlFor="agency_name"
                className="block text-xs font-medium text-slate-700"
              >
                Ajans Adı
              </label>
              <input
                id="agency_name"
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Örn: Pixel Digital"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
            </div>

            {/* Adınız Soyadınız */}
            <div>
              <label
                htmlFor="full_name"
                className="block text-xs font-medium text-slate-700"
              >
                Adınız Soyadınız
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@ajansiniz.com"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
            </div>

            {/* Şifre */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700"
              >
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
            </div>

            {/* Buton alanı */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {isSubmitting ? "Kuruluyor..." : "Ajansımı Kur ve Başla"}
              </button>
            </div>
          </form>

          {/* Küçük bilgilendirme metni */}
          <p className="mt-4 text-center text-[11px] text-slate-400">
            Kayıt olarak UMAY Hub kullanım şartlarını ve gizlilik politikasını
            kabul etmiş olursunuz.
          </p>
        </div>
      </div>
    </div>
  );
}

