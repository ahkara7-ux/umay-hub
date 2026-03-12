// Bu bileşeni "use client" ile işaretliyoruz çünkü:
// - next/navigation (usePathname) ile aktif sayfayı tespit edeceğiz,
// - Mobilde aç/kapa (drawer) davranışı için state (isOpen) props'u ile etkileşim kuracağız.
"use client";

// Next.js'te sayfa geçişlerini hızlı ve sorunsuz yapmak için Link kullanıyoruz.
import Link from "next/link";

// Aktif sayfanın path bilgisini almak için usePathname hook'unu kullanıyoruz.
// Bu sayede menüde hangi sayfanın aktif olduğunu vurgulayabiliyoruz.
import { usePathname } from "next/navigation";

// Sidebar bileşeninin alacağı props tipini tanımlıyoruz.
// - role: Kullanıcının rolü (RBAC için). Örn: "client", "owner", "manager", "developer" vb.
// - isOpen: Mobilde menü drawer'ının açık olup olmadığını kontrol eder.
// - onClose: Menü kapanması gerektiğinde çağrılır (overlay'e tık, link'e tık vb.).
type SidebarProps = {
  role?: string | null;
  isOpen: boolean;
  onClose: () => void;
};

// "Entegrasyonlar" menüsü için basit bir bar chart ikonu (SVG).
// Ekstra kütüphane kullanmadan sadece SVG ile çözüm üretiyoruz.
function BarChartIcon({ active }: { active: boolean }) {
  const stroke = active ? "#0369a1" /* sky-700 */ : "#64748b" /* slate-500 */;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 20V10"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 20V4"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 20V14"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M22 20H2"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Merkezi Sidebar bileşeni.
// Bu bileşen, uygulamadaki tüm sayfalarda aynı menü yapısını kullanmamızı sağlar (DRY).
export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  // Aktif URL path bilgisini alıyoruz.
  const pathname = usePathname();

  // Rol bazlı görünüm:
  // - Eğer rol "client" ise sadece belirli menü öğelerini gösteriyoruz.
  // - Diğer roller (owner, manager, ekip üyeleri vb.) tüm menüyü görebilir.
  const isClient = role === "client";

  // Menü öğelerini tek bir yerde tanımlıyoruz.
  // showForClient: true ise müşteri (client) rolü de görebilir.
  const items = [
    {
      key: "dashboard",
      label: "Dashboard",
      href: "/",
      iconText: "●",
      showForClient: true,
    },
    {
      key: "projects",
      label: "Projeler",
      href: "/projects",
      iconText: "PR",
      showForClient: true,
    },
    {
      key: "tasks",
      label: "Görevler",
      href: "/tasks",
      iconText: "GÖ",
      showForClient: false,
    },
    {
      key: "materials",
      label: "Materyal Onayı",
      href: "/materials",
      iconText: "MO",
      showForClient: true,
    },
    {
      key: "team",
      label: "Ekip",
      href: "/team",
      iconText: "EK",
      showForClient: false,
    },
    {
      key: "clients",
      label: "Müşteriler",
      href: "/clients",
      iconText: "MŞ",
      showForClient: false,
    },
    {
      key: "integrations",
      label: "Entegrasyonlar",
      href: "/integrations",
      iconText: null as string | null, // Bu menüde metin yerine SVG ikon kullanacağız.
      showForClient: false,
    },
    {
      key: "reports",
      label: "Raporlar",
      href: "/reports",
      iconText: "RP",
      showForClient: false,
    },
    {
      key: "settings",
      label: "Ayarlar",
      href: "/settings",
      iconText: "AY",
      showForClient: false,
    },
  ];

  // Kullanıcı client ise sadece Dashboard, Projeler ve Materyal Onayı öğelerini tutuyoruz.
  // Diğer tüm roller (owner, manager, ekip) için tüm menü öğeleri gösterilir.
  const visibleItems = items.filter((item) => {
    if (isClient) {
      // Müşterinin görebileceği menüler.
      return (
        item.key === "dashboard" ||
        item.key === "projects" ||
        item.key === "materials"
      );
    }
    return true;
  });

  // Tailwind sınıflarını tek noktadan yönetmek için bazı ortak sınıfları değişkenlerde tutuyoruz.
  const baseItemClasses = "flex items-center gap-3 rounded-lg px-3 py-2";
  const activeItemClasses =
    "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-100";
  const inactiveItemClasses =
    "text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  const iconBaseClasses =
    "inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold";
  const iconActiveClasses = "bg-sky-100 text-sky-700";
  const iconInactiveClasses = "bg-slate-100 text-slate-500";

  return (
    <>
      {/* Mobilde sidebar açıkken arka planda görünen yarı saydam karartma (overlay) alanı */}
      {/* 
        - Sadece küçük ekranlarda (lg altı) ve sidebar açıksa gösterilir.
        - Kullanıcı bu karanlık alana tıkladığında menüyü kapatıyoruz.
      */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar (Sol Menü) */}
      {/* 
        - Mobilde: fixed + translate-x ile ekranın solundan kayan bir drawer olarak davranır.
        - Masaüstünde (lg ve üstü): static konumda, her zamanki sabit sol menü görünümünü korur.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 border-r border-slate-200 bg-white/90 px-6 py-8 shadow-lg transition-transform duration-200 ease-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:static lg:inset-auto lg:translate-x-0 lg:bg-white/80 lg:shadow-sm`}
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
              <p className="text-sm font-semibold text-slate-900">UMAY Hub</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 text-sm font-medium">
          {visibleItems.map((item) => {
            // Aktif sayfa kontrolü:
            // - Dashboard için path "/" ile eşleşmeyi kontrol ediyoruz.
            // - Diğer sayfalar için path'in ilgili href ile başlaması yeterli.
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.key}
                href={item.href}
                // Mobilde menüden bir linke basıldığında drawer'ın kapanması için onClose çağırıyoruz.
                onClick={onClose}
                className={`${baseItemClasses} ${
                  isActive ? activeItemClasses : inactiveItemClasses
                }`}
              >
                <span
                  className={`${iconBaseClasses} ${
                    isActive ? iconActiveClasses : iconInactiveClasses
                  }`}
                >
                  {item.key === "integrations" ? (
                    <BarChartIcon active={isActive} />
                  ) : (
                    item.iconText
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

