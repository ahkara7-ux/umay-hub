// Bu dosyayı "use client" ile işaretliyoruz çünkü form etkileşimleri (onClick, useState, yönlendirme vb.)
// sadece tarayıcı (istemci) tarafında çalışabilir.
"use client";

// React'ten useState hook'unu alıyoruz; bu sayede form alanlarını ve hata/yalın durumlarını yönetebileceğiz.
import { useState } from "react";

// Next.js App Router'da yönlendirme (redirect) yapmak için useRouter hook'unu içe aktarıyoruz.
import { useRouter } from "next/navigation";

// Biraz önce oluşturduğumuz Supabase istemcisini (client) lib/supabase.ts dosyasından içe aktarıyoruz.
import { supabase } from "@/lib/supabase";

// Login sayfasının ana bileşenini (component) tanımlıyoruz.
// Varsayılan export olduğu için Next.js bu bileşeni /login rotasına bağlayacak.
export default function LoginPage() {
  // E-posta alanının güncel değerini saklamak için bir state oluşturuyoruz.
  const [email, setEmail] = useState("");

  // Şifre alanının güncel değerini saklamak için bir state oluşturuyoruz.
  const [password, setPassword] = useState("");

  // Herhangi bir hata oluştuğunda (örn. yanlış şifre) kullanıcıya göstereceğimiz
  // Türkçe hata mesajını burada saklıyoruz.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form işlemi (giriş veya kayıt) devam ederken butonları devre dışı bırakmak ve
  // kullanıcıya "bekle" hissi vermek için basit bir yükleniyor (loading) durumu tutuyoruz.
  const [isLoading, setIsLoading] = useState(false);

  // Yönlendirme (örn. başarılı giriş sonrası ana sayfaya / rotasına gitmek) için router nesnesini alıyoruz.
  const router = useRouter();

  // Kullanıcı "Kayıt Ol" butonuna tıkladığında çalışacak fonksiyonu tanımlıyoruz.
  const handleRegister = async () => {
    // Önce önceki olası hata mesajını sıfırlıyoruz ki eski hata ekranda kalmasın.
    setErrorMessage(null);

    // Eğer email veya şifre boşsa, direkt olarak kullanıcıyı uyarıp işlemi bitiriyoruz.
    if (!email || !password) {
      setErrorMessage("Lütfen e-posta ve şifre alanlarını doldurun.");
      return;
    }

    // İşlem başladığı için yükleniyor durumunu true yapıyoruz.
    setIsLoading(true);

    try {
      // Supabase ile kayıt oluşturmak için signUp fonksiyonunu kullanıyoruz.
      // email ve password alanlarını Supabase'e gönderiyoruz.
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      // Eğer Supabase bir hata döndürdüyse, kullanıcıya Türkçe bir hata mesajı gösteriyoruz.
      if (error) {
        setErrorMessage(
          "Kayıt olurken bir hata oluştu: " + (error.message || "")
        );
        return;
      }

      // Hata yoksa kayıt işlemimiz başarılı olmuş demektir.
      // Bu durumda kullanıcıyı ana sayfaya (dashboard) yönlendiriyoruz.
      router.push("/");
    } catch (err) {
      // Beklenmeyen bir hata olması durumunda (örneğin ağ hatası) yine kullanıcıya
      // anlaşılır bir Türkçe mesaj gösteriyoruz.
      setErrorMessage("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      // İşlem bittiği için yükleniyor durumunu tekrar false yapıyoruz.
      setIsLoading(false);
    }
  };

  // Kullanıcı "Giriş Yap" butonuna tıkladığında çalışacak fonksiyonu tanımlıyoruz.
  const handleLogin = async () => {
    // Önce önceki olası hata mesajını sıfırlıyoruz.
    setErrorMessage(null);

    // Eğer email veya şifre boşsa, direkt olarak kullanıcıyı uyarıp işlemi bitiriyoruz.
    if (!email || !password) {
      setErrorMessage("Lütfen e-posta ve şifre alanlarını doldurun.");
      return;
    }

    // İşlem başladığı için yükleniyor durumunu true yapıyoruz.
    setIsLoading(true);

    try {
      // Supabase ile parola kullanarak giriş yapmak için signInWithPassword fonksiyonunu kullanıyoruz.
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Eğer Supabase bir hata döndürdüyse (örneğin yanlış şifre), kullanıcıya Türkçe hata mesajı gösteriyoruz.
      if (error) {
        setErrorMessage(
          "Giriş yaparken bir hata oluştu: " + (error.message || "")
        );
        return;
      }

      // Hata yoksa giriş işlemi başarılı demektir.
      // Bu durumda kullanıcıyı ana sayfaya (dashboard) yönlendiriyoruz.
      router.push("/");
    } catch (err) {
      // Beklenmeyen bir hata olması durumunda (örneğin ağ hatası) yine kullanıcıya
      // anlaşılır bir Türkçe mesaj gösteriyoruz.
      setErrorMessage("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      // İşlem bittiği için yükleniyor durumunu tekrar false yapıyoruz.
      setIsLoading(false);
    }
  };

  // Bileşenin JSX ile ekran çıktısını tanımlıyoruz.
  return (
    // Tüm sayfayı kapsayan dış sarmalayıcı div.
    // min-h-screen: Yükseklik olarak en az ekran yüksekliği kadar olsun.
    // flex items-center justify-center: İçeriği hem yatay hem dikey ortala.
    // bg-slate-50: Hafif gri bir arka plan rengi (SaaS hissi).
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      {/* Kartı biraz daha dar ve odaklı göstermek için maksimum genişlik belirliyoruz. */}
      <div className="w-full max-w-md">
        {/* Giriş/Kayıt form kartı */}
        {/* bg-white: Beyaz arka plan */}
        {/* rounded-2xl: Yumuşak köşeler */}
        {/* shadow-xl: Belirgin ama abartılı olmayan gölge */}
        {/* border border-slate-100: Çok hafif gri bir çerçeve */}
        {/* p-8: İç boşluklar */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          {/* Başlık bölümü */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">
              UMAY Hub&apos;a Hoş Geldiniz
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Ajans veya Müşteri Girişi
            </p>
          </div>

          {/* Form alanları */}
          <div className="space-y-4">
            {/* E-posta alanı */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                E-posta
              </label>
              <input
                id="email"
                type="email"
                // input değerini React state&apos;i ile bağlıyoruz
                value={email}
                // Kullanıcı her yazdığında state&apos;i güncelliyoruz
                onChange={(e) => setEmail(e.target.value)}
                // Tailwind sınıfları ile şık ve modern bir input görünümü veriyoruz
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none ring-0 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                placeholder="ornek@umayhub.com"
              />
            </div>

            {/* Şifre alanı */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Şifre
              </label>
              <input
                id="password"
                type="password"
                // input değerini React state&apos;i ile bağlıyoruz
                value={password}
                // Kullanıcı her yazdığında state&apos;i güncelliyoruz
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none ring-0 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                placeholder="En az 6 karakter"
              />
            </div>
          </div>

          {/* Hata mesajı alanı */}
          {errorMessage && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Butonlar */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {/* Giriş Yap butonu */}
            <button
              type="button"
              // Butona tıklandığında giriş fonksiyonumuzu çalıştırıyoruz
              onClick={handleLogin}
              // İşlem devam ederken butonu devre dışı bırakıyoruz
              disabled={isLoading}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
            >
              {/* isLoading durumuna göre buton metnini dinamik gösteriyoruz */}
              {isLoading ? "Lütfen bekleyin..." : "Giriş Yap"}
            </button>

            {/* Kayıt Ol butonu */}
            <button
              type="button"
              onClick={handleRegister}
              disabled={isLoading}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Kayıt Ol
            </button>
          </div>

          {/* Küçük bilgilendirme metni */}
          <p className="mt-4 text-center text-xs text-slate-400">
            UMAY Hub, dijital pazarlama ajansları ve müşterilerinin
            operasyonlarını tek bir SaaS platformunda toplar.
          </p>
        </div>
      </div>
    </div>
  );
}

