// État de l'application
const appState = {
    isReading: false,
    isWriting: false,
    currentRecordType: 'text',
    history: JSON.parse(localStorage.getItem('nfc-history') || '[]')
};

// Configuration pour la protection NFC
const NFC_PROTECTION = {
    PROTECTED_PREFIX: 'NFC_PROTECTED:',
    ENCRYPTION_ALGO: 'AES-GCM'
};

// Éléments DOM
const elements = {
    // Status
    status: document.getElementById('status'),
    compatibility: document.getElementById('compatibility'),
    
    // Tool Cards
    scanCard: document.getElementById('scanCard'),
    writeCard: document.getElementById('writeCard'),
    toolsCard: document.getElementById('toolsCard'),
    savedCard: document.getElementById('savedCard'),
    
    // Scan Modal
    scanModal: document.getElementById('scanModal'),
    readBtn: document.getElementById('readBtn'),
    readResult: document.getElementById('readResult'),
    readData: document.getElementById('readData'),
    
    // Write Modal
    writeModal: document.getElementById('writeModal'),
    writeFormModal: document.getElementById('writeFormModal'),
    writeFormTitle: document.getElementById('writeFormTitle'),
    writeData: document.getElementById('writeData'),
    writeBtn: document.getElementById('writeBtn'),
    writeResult: document.getElementById('writeResult'),
    writeStatus: document.getElementById('writeStatus'),
    
    // History Modal
    historyModal: document.getElementById('historyModal'),
    history: document.getElementById('history'),
    clearHistory: document.getElementById('clearHistory'),
    
    // Detail Modal
    detailModal: document.getElementById('detailModal'),
    detailTitle: document.getElementById('detailTitle'),
    detailContent: document.getElementById('detailContent')
};

// Gestion des modals
function showModal(modal) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function hideModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

// Fonctions de navigation
function openScanModal() {
    showModal(elements.scanModal);
}

function closeScanModal() {
    hideModal(elements.scanModal);
    if (appState.isReading) {
        // Arrêter la lecture si en cours
        appState.isReading = false;
        elements.readBtn.textContent = 'Start Scanning';
        updateStatus('Lecture annulée', 'info');
    }
}

function openWriteModal() {
    showModal(elements.writeModal);
}

function closeWriteModal() {
    hideModal(elements.writeModal);
}

function openWriteFormModal(recordType) {
    appState.currentRecordType = recordType;
    const titles = {
        'url': 'Ajouter URL',
        'text': 'Ajouter texte',
        'contact': 'Ajouter contact',
        'email': 'Ajouter email',
        'wifi': 'Ajouter Wi-Fi'
    };
    
    elements.writeFormTitle.textContent = titles[recordType] || 'Add Record';
    elements.writeData.placeholder = getPlaceholderText(recordType);
    elements.writeData.value = '';
    updateWriteButtonState();
    
    hideModal(elements.writeModal);
    setTimeout(() => showModal(elements.writeFormModal), 300);
}

function closeWriteFormModal() {
    hideModal(elements.writeFormModal);
}

function openHistoryModal() {
    renderHistory();
    showModal(elements.historyModal);
}

function closeHistoryModal() {
    hideModal(elements.historyModal);
}

function openDetailModal(title, content) {
    elements.detailTitle.textContent = title;
    elements.detailContent.textContent = JSON.stringify(content, null, 2);
    showModal(elements.detailModal);
}

function closeDetailModal() {
    hideModal(elements.detailModal);
}

// Fonctions de chiffrement/déchiffrement
async function encryptData(data, password) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Générer une clé à partir du mot de passe
    const passwordBuffer = encoder.encode(password);
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    // Générer un sel aléatoire
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Dériver la clé de chiffrement
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    // Générer un IV aléatoire
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Chiffrer les données
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
    );
    
    // Combiner sel + IV + données chiffrées
    const result = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encryptedData), salt.length + iv.length);
    
    // Encoder en base64 avec préfixe
    return NFC_PROTECTION.PROTECTED_PREFIX + btoa(String.fromCharCode(...result));
}

async function decryptData(encryptedData, password) {
    if (!encryptedData.startsWith(NFC_PROTECTION.PROTECTED_PREFIX)) {
        throw new Error('Données non protégées');
    }
    
    // Retirer le préfixe et décoder base64
    const base64Data = encryptedData.substring(NFC_PROTECTION.PROTECTED_PREFIX.length);
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Extraire sel, IV et données chiffrées
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const encrypted = bytes.slice(28);
    
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Recréer la clé
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
    
    // Déchiffrer
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}

// Fonctions d'authentification pour protection NFC
function showPasswordModal(title, callback, isForProtection = false) {
    const modal = document.createElement('div');
    modal.className = 'modal password-modal active';
    modal.style.display = 'flex';
    
    const inputId = isForProtection ? 'protectionPasswordInput' : 'passwordInput';
    const callbackParam = isForProtection ? `'${callback}',true` : `'${callback}',false`;
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div></div>
                <h3>${title}</h3>
                <button class="close-btn" onclick="closePasswordModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="password-container">
                    <p class="password-instruction">${isForProtection ? 'Choisissez un mot de passe pour protéger cette carte :' : 'Entrez le mot de passe de cette carte protégée :'}</p>
                    <input type="password" id="${inputId}" class="password-input" placeholder="••••••" ${isForProtection ? 'minlength="4"' : ''}>
                    ${isForProtection ? '<p class="password-hint">Minimum 4 caractères</p>' : ''}
                    <div class="password-buttons">
                        <button class="btn btn-secondary" onclick="closePasswordModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="verifyPassword(${callbackParam})">${isForProtection ? 'Protéger' : 'Déverrouiller'}</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById(inputId).focus();
    
    // Gérer la touche Entrée
    document.getElementById(inputId).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verifyPassword(callback, isForProtection);
        }
    });
    
    window.currentPasswordModal = modal;
    window.currentPasswordCallback = { callback, isForProtection };
}

function closePasswordModal() {
    if (window.currentPasswordModal) {
        window.currentPasswordModal.remove();
        window.currentPasswordModal = null;
        window.currentPasswordCallback = null;
    }
}

function verifyPassword(callback, isForProtection = false) {
    const inputId = isForProtection ? 'protectionPasswordInput' : 'passwordInput';
    const passwordInput = document.getElementById(inputId);
    const enteredPassword = passwordInput.value;
    
    if (isForProtection) {
        // Pour la protection, vérifier la longueur minimale
        if (enteredPassword.length < 4) {
            passwordInput.style.borderColor = '#ff4757';
            setTimeout(() => {
                passwordInput.style.borderColor = '';
            }, 2000);
            updateStatus('Le mot de passe doit contenir au moins 4 caractères', 'error');
            return;
        }
        
        // Stocker le mot de passe et exécuter le callback
        window.protectionPassword = enteredPassword;
        closePasswordModal();
        updateStatus('Mot de passe défini', 'success');
        
        if (callback === 'writeNFC') {
            writeNFC();
        }
    } else {
        // Pour le déchiffrement, stocker et exécuter
        window.decryptionPassword = enteredPassword;
        closePasswordModal();
        
        if (callback === 'decryptAndDisplay') {
            decryptAndDisplayData();
        }
    }
}

// Helpers
function getPlaceholderText(recordType) {
    const placeholders = {
        'url': 'https://exemple.com',
        'text': 'Entrez votre texte ici...',
        'contact': 'Rodrigue EPUH\n+228976520\nrodrigue@exemple.com',
        'email': 'rodrigue@exemple.com',
        'wifi': 'Nom du réseau\nMot de passe'
    };
    return placeholders[recordType] || 'Enter content...';
}

// Vérification de la compatibilité
function checkCompatibility() {
    if (!('NDEFReader' in window)) {
        elements.compatibility.style.display = 'block';
        updateStatus('API Web NFC non disponible', 'error');
        return false;
    }
    return true;
}

// Mise à jour du statut
function updateStatus(message, type = 'info') {
    const statusText = elements.status.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = message;
    }
    
    const statusDot = elements.status.querySelector('.status-dot');
    if (statusDot) {
        statusDot.className = `status-dot ${type}`;
    }
}

// Formatage des données NDEF
function formatNDEFData(records) {
    return records.map((record, index) => {
        const decoder = new TextDecoder();
        let data = '';
        
        try {
            data = decoder.decode(record.data);
        } catch (e) {
            data = Array.from(new Uint8Array(record.data))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
        }

        return {
            index: index + 1,
            recordType: record.recordType,
            mediaType: record.mediaType || 'N/A',
            id: record.id || 'N/A',
            data: data,
            lang: record.lang || 'N/A'
        };
    });
}

// Affichage des données formatées
function displayFormattedData(container, data) {
    container.innerHTML = '';
    
    data.forEach(record => {
            const recordDiv = document.createElement('div');
            recordDiv.style.marginBottom = '16px';
            recordDiv.style.padding = '16px';
            recordDiv.style.border = '1px solid var(--border-light)';
            recordDiv.style.borderRadius = 'var(--radius)';
            recordDiv.style.background = 'var(--white)';
            
            const protectedBadge = record.protected ? 
                '<span style="background: var(--primary-green); color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">🔒 PROTÉGÉ</span>' : '';
            
            recordDiv.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px; color: var(--primary-green); display: flex; align-items: center;">
                    Record ${record.index}${protectedBadge}
                </div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                    <strong>Type:</strong> ${record.recordType}<br>
                    <strong>Media:</strong> ${record.mediaType}<br>
                    <strong>ID:</strong> ${record.id}<br>
                    <strong>Language:</strong> ${record.lang}
                </div>
                <div style="font-weight: 500; margin-bottom: 8px; color: var(--text-primary);">Content:</div>
                <div style="font-family: 'SF Mono', Monaco, monospace; background: var(--background); padding: 12px; border-radius: 8px; word-break: break-all; font-size: 13px; line-height: 1.4;">
                    ${record.data}
                </div>
            `;        container.appendChild(recordDiv);
    });
}

// Lecture NFC
async function readNFC() {
    if (appState.isReading) return;
    
    try {
        appState.isReading = true;
        elements.readBtn.textContent = 'Recherche tag NFC...';
        elements.readBtn.disabled = true;
        updateStatus('Approchez une carte NFC...', 'reading');

        const ndef = new NDEFReader();
        await ndef.scan();

        const readPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout - Aucune carte détectée'));
            }, 30000);

            ndef.addEventListener('reading', ({ message, serialNumber }) => {
                clearTimeout(timeout);
                resolve({ message, serialNumber });
            });

            ndef.addEventListener('readingerror', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        const { message, serialNumber } = await readPromise;
        const formattedData = formatNDEFData(message.records);
        
        // Vérifier si les données sont protégées
        const firstRecord = message.records[0];
        if (firstRecord && firstRecord.recordType === 'text') {
            const decoder = new TextDecoder();
            const data = decoder.decode(firstRecord.data);
            
            if (data.startsWith(NFC_PROTECTION.PROTECTED_PREFIX)) {
                // Données protégées - demander le mot de passe
                window.encryptedNFCData = data;
                window.nfcSerialNumber = serialNumber;
                showPasswordModal('Carte protégée', 'decryptAndDisplay');
                return;
            }
        }
        
        // Données non protégées - affichage normal
        displayFormattedData(elements.readData, formattedData);
        elements.readResult.style.display = 'block';
        
        // Ajout à l'historique
        addToHistory('read', {
            serialNumber,
            records: formattedData,
            timestamp: new Date().toISOString(),
            protected: false
        });
        
        updateStatus('Lecture réussie !', 'success');
        
    } catch (error) {
        console.error('Erreur de lecture NFC:', error);
        updateStatus(`Erreur: ${error.message}`, 'error');
        elements.readResult.style.display = 'none';
    } finally {
        appState.isReading = false;
        elements.readBtn.textContent = 'Commencer le scan';
        elements.readBtn.disabled = false;
    }
}

// Fonction pour déchiffrer et afficher les données protégées
async function decryptAndDisplayData() {
    try {
        const decryptedData = await decryptData(window.encryptedNFCData, window.decryptionPassword);
        
        // Créer un objet formaté pour l'affichage
        const formattedData = [{
            index: 1,
            recordType: 'text',
            mediaType: 'text/plain',
            id: 'N/A',
            data: decryptedData,
            lang: 'N/A',
            protected: true
        }];
        
        // Affichage des données déchiffrées
        displayFormattedData(elements.readData, formattedData);
        elements.readResult.style.display = 'block';
        
        // Ajout à l'historique
        addToHistory('read', {
            serialNumber: window.nfcSerialNumber,
            records: formattedData,
            timestamp: new Date().toISOString(),
            protected: true
        });
        
        updateStatus('Déchiffrement réussi !', 'success');
        
        // Nettoyer les variables temporaires
        delete window.encryptedNFCData;
        delete window.nfcSerialNumber;
        delete window.decryptionPassword;
        
    } catch (error) {
        console.error('Erreur de déchiffrement:', error);
        updateStatus('Mot de passe incorrect', 'error');
        
        // Permettre de réessayer
        showPasswordModal('Mot de passe incorrect - Réessayez', 'decryptAndDisplay');
    } finally {
        appState.isReading = false;
        elements.readBtn.textContent = 'Commencer le scan';
        elements.readBtn.disabled = false;
    }
}

// Écriture NFC
async function writeNFC() {
    if (appState.isWriting || !elements.writeData.value.trim()) return;
    
    // Demander si l'utilisateur veut protéger la carte
    const shouldProtect = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal protection-choice-modal active';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div></div>
                    <h3>Protection de la carte</h3>
                    <div></div>
                </div>
                <div class="modal-body">
                    <div class="protection-choice">
                        <p class="choice-instruction">Voulez-vous protéger cette carte par mot de passe ?</p>
                        <div class="choice-buttons">
                            <button class="btn btn-secondary" onclick="resolveProtection(false)">Non, écriture simple</button>
                            <button class="btn btn-primary" onclick="resolveProtection(true)">🔒 Oui, protéger</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        window.currentProtectionModal = modal;
        window.resolveProtection = (choice) => {
            modal.remove();
            resolve(choice);
        };
    });
    
    if (shouldProtect) {
        // Demander le mot de passe de protection
        showPasswordModal('Protéger la carte', 'writeNFC', true);
        return;
    }
    
    // Écriture directe sans protection
    await performWrite(elements.writeData.value.trim());
}

async function performWrite(data, isProtected = false) {
    try {
        appState.isWriting = true;
        elements.writeBtn.textContent = 'Approchez l\'appareil du tag NFC...';
        elements.writeBtn.disabled = true;
        updateStatus('Prêt pour l\'écriture...', 'writing');

        const ndef = new NDEFReader();
        let finalData = data;
        
        // Si protection demandée, chiffrer les données
        if (isProtected && window.protectionPassword) {
            finalData = await encryptData(data, window.protectionPassword);
            delete window.protectionPassword; // Nettoyer le mot de passe
        }
        
        const recordType = appState.currentRecordType;
        let record;
        
        switch (recordType) {
            case 'url':
                record = { recordType: 'url', data: finalData };
                break;
            case 'contact':
                record = { recordType: 'text', data: finalData };
                break;
            case 'email':
                record = { recordType: 'text', data: isProtected ? finalData : `mailto:${finalData}` };
                break;
            case 'wifi':
                record = { recordType: 'text', data: finalData };
                break;
            default:
                record = { recordType: 'text', data: finalData };
        }

        await ndef.write({ records: [record] });
        
        // Affichage du succès
        elements.writeStatus.textContent = isProtected ? 
            '🔒 Carte protégée et écrite avec succès !' : 
            'Écriture réussie sur le tag NFC !';
        elements.writeStatus.className = 'status-message success';
        elements.writeResult.style.display = 'block';
        
        // Ajout à l'historique
        addToHistory('write', {
            recordType,
            data: data, // Données originales non chiffrées pour l'historique
            timestamp: new Date().toISOString(),
            protected: isProtected
        });
        
        updateStatus(isProtected ? 'Carte protégée et écrite !' : 'Écriture réussie !', 'success');
        
        // Réinitialisation du formulaire
        setTimeout(() => {
            elements.writeData.value = '';
            closeWriteFormModal();
        }, 2000);
        
    } catch (error) {
        console.error('Erreur d\'écriture NFC:', error);
        elements.writeStatus.textContent = `Erreur: ${error.message}`;
        elements.writeStatus.className = 'status-message error';
        elements.writeResult.style.display = 'block';
        updateStatus(`Erreur: ${error.message}`, 'error');
    } finally {
        appState.isWriting = false;
        elements.writeBtn.textContent = 'Écrire sur tag';
        updateWriteButtonState();
    }
}

// Modifier la fonction verifyPassword pour gérer la protection
window.performWrite = performWrite;

// Gestion de l'historique
function addToHistory(type, data) {
    const historyItem = {
        id: Date.now(),
        type,
        data,
        timestamp: new Date().toISOString()
    };
    
    appState.history.unshift(historyItem);
    
    // Limiter à 50 éléments
    if (appState.history.length > 50) {
        appState.history = appState.history.slice(0, 50);
    }
    
    localStorage.setItem('nfc-history', JSON.stringify(appState.history));
}

function renderHistory() {
    if (appState.history.length === 0) {
        elements.history.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📱</div>
                <p>Aucun tag sauvegardé</p>
                <span>Les tags sauvegardés apparaîtront ici</span>
            </div>
        `;
        return;
    }
    
    elements.history.innerHTML = appState.history
        .map(item => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const typeIcon = item.type === 'read' ? '📖' : '✏️';
            const typeText = item.type === 'read' ? 'Lecture' : 'Écriture';
            
            let preview = '';
            if (item.type === 'read') {
                const protectedText = item.data.protected ? ' 🔒' : '';
                preview = `${item.data.records.length} record(s)${protectedText}`;
                if (item.data.serialNumber) {
                    preview += ` • ${item.data.serialNumber.substring(0, 12)}...`;
                }
            } else {
                const protectedText = item.data.protected ? ' 🔒' : '';
                preview = item.data.data.substring(0, 40);
                if (item.data.data.length > 40) preview += '...';
                preview += protectedText;
            }
            
            return `
                <div class="history-item" onclick="showHistoryDetails(${item.id})">
                    <div class="history-item-header">
                        <span class="history-item-type">${typeIcon} ${typeText}</span>
                        <span class="history-item-time">${timeStr}</span>
                    </div>
                    <div class="history-item-data">${preview}</div>
                </div>
            `;
        })
        .join('');
}

function showHistoryDetails(id) {
    const item = appState.history.find(h => h.id === id);
    if (!item) return;
    
    const title = `${item.type === 'read' ? 'Lecture' : 'Écriture'} - Détails`;
    openDetailModal(title, item.data);
}

function clearHistory() {
    if (confirm('Êtes-vous sûr de vouloir effacer l\'historique ?')) {
        appState.history = [];
        localStorage.removeItem('nfc-history');
        renderHistory();
        updateStatus('Historique effacé', 'info');
    }
}

// Gestion de l'état du bouton d'écriture
function updateWriteButtonState() {
    if (!elements.writeData) return;
    const hasData = elements.writeData.value.trim().length > 0;
    const isAvailable = checkCompatibility() && !appState.isWriting;
    elements.writeBtn.disabled = !hasData || !isAvailable;
}

// Gestion des événements
function setupEventListeners() {
    // Tool Cards
    elements.scanCard?.addEventListener('click', openScanModal);
    elements.writeCard?.addEventListener('click', openWriteModal);
    elements.savedCard?.addEventListener('click', openHistoryModal);
    
    // Scan Modal
    elements.readBtn?.addEventListener('click', readNFC);
    
    // Write Modal - Record Types
    document.querySelectorAll('.record-type').forEach(recordType => {
        recordType.addEventListener('click', () => {
            const type = recordType.dataset.type;
            openWriteFormModal(type);
        });
    });
    
    // Write Form
    elements.writeBtn?.addEventListener('click', writeNFC);
    elements.writeData?.addEventListener('input', updateWriteButtonState);
    
    // History
    elements.clearHistory?.addEventListener('click', clearHistory);
    
    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
                setTimeout(() => activeModal.style.display = 'none', 300);
            }
        }
    });
}

// Fonctions globales pour le HTML
window.closeScanModal = closeScanModal;
window.closeWriteModal = closeWriteModal;
window.closeWriteFormModal = closeWriteFormModal;
window.closeHistoryModal = closeHistoryModal;
window.closeDetailModal = closeDetailModal;
window.showHistoryDetails = showHistoryDetails;
window.closePasswordModal = closePasswordModal;
window.verifyPassword = verifyPassword;
window.performWrite = performWrite;

// Initialisation
function init() {
    console.log('🚀 Initialisation NFCTools');
    
    if (checkCompatibility()) {
        updateStatus('Prêt à scanner', 'success');
    }
    
    setupEventListeners();
    
    console.log('✅ Application initialisée');
}

// Démarrage de l'application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
