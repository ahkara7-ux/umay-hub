// Supabase istemcisi için gerekli fonksiyonu @supabase/supabase-js paketinden içe aktarıyoruz
import { createClient } from "@supabase/supabase-js";

// Tarayıcı tarafında kullanılacak olan Supabase URL bilgisini ortam değişkeninden alıyoruz
// Bu değeri .env.local dosyasında NEXT_PUBLIC_SUPABASE_URL olarak tanımlamıştık
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Tarayıcı tarafında kullanılacak olan Supabase ANON (public) anahtarını ortam değişkeninden alıyoruz
// Bu değeri .env.local dosyasında NEXT_PUBLIC_SUPABASE_ANON_KEY olarak tanımlamıştık
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Eğer Supabase URL değeri tanımlı değilse, anlaşılır bir hata fırlatıyoruz
// Bu sayede proje çalışırken ortam değişkeni eksikse hatayı hızlıca yakalayabilirsiniz
if (!supabaseUrl) {
  throw new Error(
    "Supabase URL değeri bulunamadı. Lütfen .env.local dosyasına NEXT_PUBLIC_SUPABASE_URL bilgisini ekleyin."
  );
}

// Eğer Supabase ANON KEY değeri tanımlı değilse, yine anlaşılır bir hata fırlatıyoruz
if (!supabaseAnonKey) {
  throw new Error(
    "Supabase ANON KEY değeri bulunamadı. Lütfen .env.local dosyasına NEXT_PUBLIC_SUPABASE_ANON_KEY bilgisini ekleyin."
  );
}

// Yukarıda aldığımız URL ve ANON KEY değerleri ile Supabase istemcisini (client) oluşturuyoruz
// createClient fonksiyonu, Supabase'e HTTP üzerinden istek atabilen hazır bir istemci üretir
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Bu dosyadan dışa aktardığımız supabase nesnesini,
// projenin her yerinde "import { supabase } from '@/lib/supabase';" diyerek kullanabilirsiniz
// Örneğin: const { data, error } = await supabase.from('tablo_adi').select('*');

