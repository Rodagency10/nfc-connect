# NFC Connect 📡

Une application web minimaliste et élégante pour lire et écrire sur des cartes NFC en utilisant l'API Web NFC.

## ✨ Fonctionnalités

- **📖 Lecture NFC** : Lecture des données NDEF depuis les cartes NFC
- **✏️ Écriture NFC** : Écriture de texte, URLs ou données MIME sur les cartes NFC
- **📋 Historique** : Suivi de toutes les opérations effectuées
- **🎨 Interface moderne** : Design minimaliste et responsive
- **💾 Persistance** : L'historique est sauvegardé localement

## 🚀 Utilisation

1. Ouvrez `index.html` dans un navigateur compatible (voir compatibilité ci-dessous)
2. Utilisez HTTPS ou localhost pour que l'API Web NFC fonctionne
3. Cliquez sur "Commencer la lecture" pour lire une carte NFC
4. Entrez du texte et cliquez sur "Écrire sur la carte" pour écrire des données

## 🔧 Compatibilité

L'API Web NFC est disponible sur :
- ✅ Chrome/Chromium 89+ (Android)
- ✅ Edge 89+ (Android)
- ❌ Firefox (non supporté)
- ❌ Safari (non supporté)
- ❌ Desktop (non supporté pour l'instant)

**Important** : L'application doit être servie via HTTPS ou localhost pour fonctionner.

## 📱 Test sur mobile

Pour tester sur un appareil mobile Android :

1. Déployez l'application sur un serveur HTTPS
2. Ou utilisez un serveur de développement local avec HTTPS
3. Ouvrez l'application dans Chrome mobile
4. Accordez les permissions NFC si demandées

## 🛠️ Développement local

Pour tester localement avec HTTPS :

```bash
# Avec Python
python -m http.server 8000

# Avec Node.js (http-server)
npx http-server -p 8000

# Avec Live Server (VS Code extension)
# Clic droit sur index.html > "Open with Live Server"
```

## 📋 Types de données supportés

- **Texte** : Texte simple encodé en UTF-8
- **URL** : Adresses web complètes (http:// ou https://)
- **MIME** : Données avec type MIME personnalisé

## 🔒 Sécurité

- L'application fonctionne uniquement en HTTPS
- Les données sont traitées côté client uniquement
- L'historique est stocké localement (localStorage)
- Aucune donnée n'est envoyée vers des serveurs externes

## 📁 Structure du projet

```
ConnectApp/
├── index.html          # Interface principale
├── styles.css          # Styles CSS (design moderne)
├── script.js           # Logique JavaScript (API Web NFC)
└── README.md           # Documentation
```

## 🎨 Personnalisation

Les couleurs et styles peuvent être facilement modifiés via les variables CSS dans `styles.css` :

```css
:root {
    --primary-color: #2563eb;
    --secondary-color: #059669;
    --background: #f8fafc;
    /* ... */
}
```

## 📚 Ressources

- [API Web NFC - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API)
- [Spécification Web NFC](https://w3c.github.io/web-nfc/)
- [Can I use Web NFC](https://caniuse.com/web-nfc)

## 🐛 Dépannage

### L'API n'est pas disponible
- Vérifiez que vous utilisez un navigateur compatible
- Assurez-vous d'être en HTTPS ou localhost
- Vérifiez que le NFC est activé sur l'appareil

### Erreurs de lecture/écriture
- Approchez la carte NFC plus près de l'appareil
- Maintenez la carte stable pendant l'opération
- Vérifiez que la carte NFC est compatible NDEF

### Permissions refusées
- Accordez les permissions NFC dans les paramètres du navigateur
- Rechargez la page après avoir accordé les permissions

---

Made with ❤️ using Web NFC API
