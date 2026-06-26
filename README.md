# Kiraex3 Guard Bot 🛡️

Kiraex3 Guard Bot, Discord sunucunuzun güvenliğini sağlamak için geliştirilmiş, yetkisiz eylemleri izleyen ve engelleyen açık kaynaklı bir koruma (guard) botudur.

## Özellikler

Bot, sunucudaki hassas değişiklikleri takip eder ve güvenli listede (whitelist) olmayan bir kullanıcı bu işlemleri gerçekleştirdiğinde yetkilerini sıfırlar (tüm rollerini alır):

* **Rol Silme Koruması:** Sunucudan bir rol silindiğinde, eylemi gerçekleştiren kullanıcının yetki/rollerini alır ve log kanalına bildirir.
* **Kanal Silme Koruması:** Sunucudan bir kanal silindiğinde, eylemi gerçekleştiren kullanıcının yetki/rollerini alır ve log kanalına bildirir.
* **Kanal Güncelleme Koruması:** Bir kanalın ismi izinsiz değiştirildiğinde, kanal adını otomatik olarak eski haline getirir ve değiştiren kullanıcının yetki/rollerini alarak log kanalına bildirir.

## Gereksinimler

* [Node.js](https://nodejs.org/) (v16.11.0 veya daha yeni bir sürüm)
* Aktif bir Discord Botu ve Tokeni

## Kurulum ve Yapılandırma

1. Bu depoyu bilgisayarınıza indirin veya klonlayın.
2. Proje dizininde terminali/komut satırını açarak bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
3. `config.json` dosyasını bir metin editörüyle açın ve gerekli alanları doldurun:
   ```json
   {
     "token": "BOT_TOKENINIZ",
     "logCategoryId": "LOG_KANALININ_OLUSTURULACAGI_KATEGORI_ID"
   }
   ```
   * **token:** Discord Developer Portal üzerinden aldığınız bot tokeni.
   * **logCategoryId:** Koruma günlüklerinin (log) ve `guard-log` kanalının oluşturulacağı kategori ID'si.

## Başlatma

### Windows için
Proje dizininde bulunan `start.bat` dosyasına çift tıklayarak botu kolayca başlatabilirsiniz. Bu betik botun çökme durumlarında 5 saniye içinde otomatik olarak yeniden başlatılmasını sağlar.

### Diğer İşletim Sistemleri için
Terminal üzerinden şu komutla botu çalıştırabilirsiniz:
```bash
node index.js
```

## Lisans ve Geliştirici

Bu proje **MIT Lisansı** altında lisanslanmıştır. Daha fazla bilgi için [LICENSE](LICENSE) dosyasına göz atabilirsiniz.

* **Geliştiren Discord Hesabı:** `xkira.exe`
