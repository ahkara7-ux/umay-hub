// Türkçe açıklamalı, RBAC kontrollü "Müşteri Raporları" sayfası.
// Bu sayfa sadece ajans sahibi (owner) ve ajans yöneticisi (manager) tarafından görülebilir.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";

// Profil tipimizi temel alanlardan oluşturuyoruz.
type ProfileRole =
  | "owner"
  | "manager"
  | "videographer"
  | "graphic_designer"
  | "developer"
  | "content_creator"
  | "social_media_manager"
  | "client";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: ProfileRole;
  agency_id: string | null;
}

// Müşteri tipimiz (client rolüne sahip profiller)
interface ClientProfile {
  id: string;
  email: string | null;
  full_name: string | null;
}

// Rapor tipimiz (client_reports tablosu)
interface ClientReport {
  id: string;
  client_id: string;
  agency_id: string;
  period: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  strategy_note: string | null;
}

export default function ReportsPage() {
  const router = useRouter();

  // Oturum ve profil state'leri
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >["data"]["session"] | null>(null);

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(
    null
  );

  // RBAC için yetki kontrolü (sadece owner ve manager görebilecek)
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Müşteri listesi (client rolündeki profiller)
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isClientsLoading, setIsClientsLoading] = useState(false);

  // Rapor listesi
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [isReportsLoading, setIsReportsLoading] = useState(false);

  // Form state'leri
  const [selectedClientId, setSelectedClientId] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [spendTl, setSpendTl] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [conversions, setConversions] = useState("");
  const [strategyNote, setStrategyNote] = useState("");
  const [isSavingReport, setIsSavingReport] = useState(false);

  // Kullanıcı e-postasını header'da göstermek için saklıyoruz.
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // 1) OTURUM KONTROLÜ
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Oturum kontrolü sırasında hata:", error);
          setIsCheckingSession(false);
          router.push("/login");
          return;
        }

        if (!data.session) {
          setIsCheckingSession(false);
          router.push("/login");
          return;
        }

        setSession(data.session);
        setUserEmail(data.session.user.email ?? null);
      } catch (err) {
        console.error("Oturum kontrolü sırasında beklenmeyen hata:", err);
        router.push("/login");
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, [router]);

  // 2) PROFİL (RBAC) BİLGİLERİNİ ÇEKME
  useEffect(() => {
    // Henüz oturum yoksa profil çekmeye çalışmıyoruz.
    if (!session?.user?.email) return;

    const fetchProfile = async () => {
      setIsProfileLoading(true);
      setProfileErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, agency_id")
          .eq("email", session.user.email)
          .maybeSingle();

        if (error) {
          console.error("Profil bilgisi alınırken hata oluştu:", error);
          setProfileErrorMessage(
            "Profil bilgilerinize ulaşılırken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
          );
          return;
        }

        if (!data) {
          setProfileErrorMessage(
            "Profil kaydınız bulunamadı. Lütfen sistem yöneticinizle iletişime geçin."
          );
          return;
        }

        const castedProfile = data as Profile;
        setCurrentProfile(castedProfile);

        // RBAC: sadece owner ve manager rolleri bu sayfayı görebilir
        if (castedProfile.role === "owner" || castedProfile.role === "manager") {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error(
          "Profil bilgisi alınırken beklenmeyen bir hata oluştu:",
          err
        );
        setProfileErrorMessage(
          "Profil bilgilerinize ulaşılamadı. Lütfen daha sonra tekrar deneyin."
        );
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  // 3) AJANSA AİT MÜŞTERİLERİ (client rolü) ÇEKME
  useEffect(() => {
    // Profil veya agency_id yoksa müşterileri çekemeyiz.
    if (!currentProfile?.agency_id) return;

    const fetchClients = async () => {
      setIsClientsLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, agency_id")
          .eq("agency_id", currentProfile.agency_id)
          .eq("role", "client");

        if (error) {
          console.error(
            "Müşteri listesi alınırken bir hata oluştu:",
            error
          );
          return;
        }

        setClients(
          ((data as Profile[]) || []).map((p) => ({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
          }))
        );
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
  }, [currentProfile]);

  // 4) AJANSA AİT RAPORLARI ÇEKME
  const refreshReports = async () => {
    if (!currentProfile?.agency_id) return;

    setIsReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_reports")
        .select(
          "id, client_id, agency_id, period, spend, impressions, clicks, conversions, strategy_note"
        )
        .eq("agency_id", currentProfile.agency_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "Rapor listesi alınırken bir hata oluştu:",
          error
        );
        return;
      }

      setReports((data as ClientReport[]) || []);
    } catch (err) {
      console.error(
        "Rapor listesi alınırken beklenmeyen bir hata oluştu:",
        err
      );
    } finally {
      setIsReportsLoading(false);
    }
  };

  useEffect(() => {
    if (currentProfile?.agency_id) {
      refreshReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.agency_id]);

  // 5) YENİ RAPOR KAYDI OLUŞTURMA
  const handleCreateReport = async () => {
    // Basit form doğrulama
    if (!selectedClientId) {
      alert("Lütfen bir müşteri seçin.");
      return;
    }

    if (!periodMonth || !periodYear) {
      alert("Lütfen rapor dönemini (Ay ve Yıl) doldurun.");
      return;
    }

    if (!currentProfile || !currentProfile.agency_id) {
      alert(
        "Ajans bilginiz bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin."
      );
      return;
    }

    setIsSavingReport(true);

    try {
      const periodLabel = `${periodMonth} ${periodYear}`;

      // Sayısal alanları number'a çeviriyoruz. Boşsa null gönderiyoruz.
      const spendValue =
        spendTl.trim() === "" ? null : Number(spendTl.replace(",", "."));
      const impressionsValue =
        impressions.trim() === "" ? null : Number(impressions);
      const clicksValue = clicks.trim() === "" ? null : Number(clicks);
      const conversionsValue =
        conversions.trim() === "" ? null : Number(conversions);

      const { error } = await supabase.from("client_reports").insert({
        client_id: selectedClientId,
        agency_id: currentProfile.agency_id,
        period: periodLabel,
        spend: spendValue,
        impressions: impressionsValue,
        clicks: clicksValue,
        conversions: conversionsValue,
        strategy_note: strategyNote || null,
      });

      if (error) {
        console.error("DETAYLI VERİTABANI HATASI (RAPOR):", error);
        alert(`Rapor kaydedilirken hata oluştu: ${error.message}`);
        return;
      }

      // Formu temizliyoruz.
      setSelectedClientId("");
      setPeriodMonth("");
      setPeriodYear("");
      setSpendTl("");
      setImpressions("");
      setClicks("");
      setConversions("");
      setStrategyNote("");

      // Rapor listesini yeniliyoruz.
      await refreshReports();
    } catch (err) {
      console.error(
        "Rapor kaydı sırasında beklenmeyen bir hata oluştu:",
        err
      );
      alert(
        "Rapor kaydı sırasında beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin."
      );
    } finally {
      setIsSavingReport(false);
    }
  };

  // 6) ÇIKIŞ İŞLEMİ
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Çıkış yapılırken bir hata oluştu:", error);
      }
    } finally {
      router.push("/login");
    }
  };

  // 7) ERKEN DÖNÜŞLER: YÜKLENİYOR / HATA / YETKİSİZ
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
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 shadow-sm shadow-rose-100">
          <p className="mb-1 font-semibold text-rose-900">Yetkisiz Erişim</p>
          <p className="text-xs text-rose-700">
            Bu sayfa yalnızca ajans sahibi (owner) ve ajans yöneticisi
            (manager) tarafından görüntülenebilir. Müşteri hesapları bu sayfaya
            erişemez.
          </p>
        </div>
      </div>
    );
  }

  // 8) YARDIMCI: Müşteri ID -> Ad map'i (liste görünümünde isim göstermek için)
  const clientMap = new Map(
    clients.map((c) => [
      c.id,
      c.full_name || c.email || "İsimsiz Müşteri",
    ])
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative mx-auto flex min-h-screen max-w-7xl">
        {/* Merkezi Sidebar */}
        <Sidebar
          role={currentProfile.role}
          isOpen={false}
          onClose={() => {}}
        />

        {/* Sağ ana bölüm */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold text-white shadow-sm lg:flex">
                U
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Modül
                </p>
                <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Müşteri Raporları
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-slate-400">
                  Oturum Açık
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {userEmail ?? "Kullanıcı"}
                </p>
              </div>

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

          {/* İçerik */}
          <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {/* Sayfa başlığı ve açıklama */}
              <section>
                <h2 className="text-lg font-semibold text-slate-900">
                  Akıllı, Manuel Müşteri Raporları
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Meta API&apos;si yerine, müşterileriniz için elle hazırlanmış
                  stratejik aylık raporlar oluşturun ve geçmiş raporları tek
                  ekranda görüntüleyin.
                </p>
              </section>

              {/* Rapor ekleme formu */}
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Yeni Rapor Ekle
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Önce müşteriyi seçin, ardından ilgili dönem ve performans
                      metriklerini girin. Ajans strateji notunuz, toplantılarda
                      en çok işe yarayan kısımdır.
                    </p>

                    <div className="mt-4 space-y-4">
                      {/* Müşteri Seçimi */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700">
                          Müşteri Seçimi
                        </label>
                        <select
                          value={selectedClientId}
                          onChange={(e) =>
                            setSelectedClientId(e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          disabled={isClientsLoading || isSavingReport}
                        >
                          <option value="">
                            {isClientsLoading
                              ? "Müşteriler yükleniyor..."
                              : "Bir müşteri seçin"}
                          </option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.full_name ??
                                client.email ??
                                "İsimsiz Müşteri"}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dönem: Ay / Yıl */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Ay
                          </label>
                          <input
                            type="text"
                            placeholder="Örn: Ocak"
                            value={periodMonth}
                            onChange={(e) => setPeriodMonth(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            disabled={isSavingReport}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Yıl
                          </label>
                          <input
                            type="text"
                            placeholder="2026"
                            value={periodYear}
                            onChange={(e) => setPeriodYear(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            disabled={isSavingReport}
                          />
                        </div>
                      </div>

                      {/* Sayısal metrikler */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Harcanan Tutar (TL)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Örn: 12500"
                            value={spendTl}
                            onChange={(e) => setSpendTl(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            disabled={isSavingReport}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Gösterim
                          </label>
                          <input
                            type="number"
                            min={0}
                            placeholder="Örn: 85000"
                            value={impressions}
                            onChange={(e) => setImpressions(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            disabled={isSavingReport}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Tıklama
                          </label>
                          <input
                            type="number"
                            min={0}
                            placeholder="Örn: 1200"
                            value={clicks}
                            onChange={(e) => setClicks(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            disabled={isSavingReport}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Dönüşüm
                          </label>
                          <input
                            type="number"
                            min={0}
                            placeholder="Örn: 45"
                            value={conversions}
                            onChange={(e) => setConversions(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            disabled={isSavingReport}
                          />
                        </div>
                      </div>

                      {/* Ajans Strateji Notu */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700">
                          Ajans Strateji Notu
                        </label>
                        <textarea
                          rows={4}
                          placeholder="Örn: Bu ay kreatifleri test ettik, remarketing bütçesini %20 artırdık, lead kalitesinde iyileşme gördük..."
                          value={strategyNote}
                          onChange={(e) => setStrategyNote(e.target.value)}
                          className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          disabled={isSavingReport}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateReport}
                        disabled={isSavingReport}
                        className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                      >
                        {isSavingReport ? "Kaydediliyor..." : "Raporu Kaydet"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rapor listesi */}
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Geçmiş Raporlar
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Ajansınız tarafından girilen tüm müşteri raporları.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={refreshReports}
                        disabled={isReportsLoading}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isReportsLoading ? "Yenileniyor..." : "Yenile"}
                      </button>
                    </div>

                    {isReportsLoading ? (
                      <div className="flex items-center justify-center px-6 py-10 text-sm text-slate-500">
                        Raporlar yükleniyor...
                      </div>
                    ) : reports.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                        <p className="text-sm font-medium text-slate-700">
                          Henüz kayıtlı bir rapor bulunmuyor.
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Soldaki formu kullanarak ilk müşteri raporunuzu
                          oluşturun.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                          <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            <tr>
                              <th className="px-4 py-3 text-left sm:px-6">
                                Müşteri
                              </th>
                              <th className="px-4 py-3 text-left sm:px-6">
                                Dönem
                              </th>
                              <th className="px-4 py-3 text-right sm:px-6">
                                Harcama (TL)
                              </th>
                              <th className="px-4 py-3 text-right sm:px-6">
                                Gösterim
                              </th>
                              <th className="px-4 py-3 text-right sm:px-6">
                                Tıklama
                              </th>
                              <th className="px-4 py-3 text-right sm:px-6">
                                Dönüşüm
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white text-xs">
                            {reports.map((report) => (
                              <tr key={report.id}>
                                <td className="px-4 py-3 sm:px-6">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-900">
                                      {clientMap.get(report.client_id) ??
                                        "Bilinmeyen Müşteri"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-700 sm:px-6">
                                  {report.period ?? "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-900 sm:px-6">
                                  {report.spend != null
                                    ? `${report.spend.toLocaleString("tr-TR")} TL`
                                    : "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700 sm:px-6">
                                  {report.impressions != null
                                    ? report.impressions.toLocaleString("tr-TR")
                                    : "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700 sm:px-6">
                                  {report.clicks != null
                                    ? report.clicks.toLocaleString("tr-TR")
                                    : "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700 sm:px-6">
                                  {report.conversions != null
                                    ? report.conversions.toLocaleString("tr-TR")
                                    : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

