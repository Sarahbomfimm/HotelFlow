import {
    collection,
    doc,
    onSnapshot,
    setDoc,
    deleteDoc,
    addDoc,
    updateDoc,
    query,
    where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

const PRESENCE_COLLECTION = 'presence';
const PRESENCE_STORAGE_KEY = 'hotelflow:mundo:presence:v1';

// Formato padrão de dados do usuário no Mundo
function normalizePresenceRecord(id, data) {
    return {
        id,
        nome: data?.nome || 'Hóspede',
        x: typeof data?.x === 'number' ? data.x : 2,
        y: typeof data?.y === 'number' ? data.y : 2,
        room: data?.room || 'Recepção',
        avatarStyle: data?.avatarStyle || {
            skinColor: '#FCD34D', // Amarelo Gold padrão
            hairStyle: 'short',
            hairColor: '#475569', // Cinza
            shirtStyle: 'tshirt',
            shirtColor: '#0A3D62', // Azul HotelFlow
            pantsColor: '#1E293B',
            accessory: 'none'
        },
        message: data?.message || '',
        messageTime: data?.messageTime || null,
        lastActive: data?.lastActive || new Date().toISOString(),
    };
}

// Ler do cache local para suporte offline
export function readStoredPresence() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredPresence(presenceList) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(presenceList));
}

// Se inscrever em tempo real nos jogadores ativos do Mundo
export function subscribeMundoPresence(onData) {
    if (!isFirebaseConfigured || !db) {
        // Fallback offline
        onData(readStoredPresence());
        return () => {};
    }

    const presenceRef = collection(db, PRESENCE_COLLECTION);

    return onSnapshot(presenceRef, (snapshot) => {
        if (snapshot.empty) {
            onData([]);
            return;
        }

        const activePlayers = snapshot.docs.map((docSnap) => 
            normalizePresenceRecord(docSnap.id, docSnap.data())
        );

        // Limpar registros inativos (mais de 15 minutos sem atividade) cliente-side
        const now = new Date();
        const freshPlayers = activePlayers.filter((player) => {
            const lastActiveTime = new Date(player.lastActive);
            const diffMinutes = (now - lastActiveTime) / 1000 / 60;
            return diffMinutes < 15; // Mantém quem esteve ativo nos últimos 15 min
        });

        writeStoredPresence(freshPlayers);
        onData(freshPlayers);
    }, () => {
        // Fallback em caso de erro
        onData(readStoredPresence());
    });
}

// Atualizar posição, sala, customização ou fala do jogador ativo
export async function updateMundoPresence(userId, payload) {
    const freshPayload = {
        ...payload,
        lastActive: new Date().toISOString()
    };

    const normalized = normalizePresenceRecord(userId, freshPayload);

    // Atualizar cache local
    const current = readStoredPresence();
    const updatedCache = [
        normalized,
        ...current.filter((player) => player.id !== userId)
    ];
    writeStoredPresence(updatedCache);

    if (!isFirebaseConfigured || !db) {
        return normalized;
    }

    // Gravar no Firestore
    const userDocRef = doc(db, PRESENCE_COLLECTION, userId);
    await setDoc(userDocRef, freshPayload, { merge: true });
    return normalized;
}

// Remover jogador ativo ao sair
export async function removeMundoPresence(userId) {
    const current = readStoredPresence();
    const updatedCache = current.filter((player) => player.id !== userId);
    writeStoredPresence(updatedCache);

    if (!isFirebaseConfigured || !db) {
        return;
    }

    try {
        const userDocRef = doc(db, PRESENCE_COLLECTION, userId);
        await deleteDoc(userDocRef);
    } catch {
        // Ignora falhas para não travar a navegação de saída
    }
}

const LAYOUT_COLLECTION = 'room_layouts';
const LAYOUT_STORAGE_KEY_PREFIX = 'hotelflow:room_layout:';

// Subscrever em tempo real as configurações de decoração da sala
export function subscribeRoomLayout(roomName, onData) {
    if (!isFirebaseConfigured || !db) {
        // Fallback offline
        const localKey = `${LAYOUT_STORAGE_KEY_PREFIX}${roomName}`;
        if (typeof window !== 'undefined') {
            const saved = window.localStorage.getItem(localKey);
            onData(saved ? JSON.parse(saved) : null);
        } else {
            onData(null);
        }
        return () => {};
    }

    const docRef = doc(db, LAYOUT_COLLECTION, roomName);

    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const localKey = `${LAYOUT_STORAGE_KEY_PREFIX}${roomName}`;
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(localKey, JSON.stringify(data));
            }
            onData(data);
        } else {
            onData(null);
        }
    }, () => {
        // Fallback on error
        const localKey = `${LAYOUT_STORAGE_KEY_PREFIX}${roomName}`;
        if (typeof window !== 'undefined') {
            const saved = window.localStorage.getItem(localKey);
            onData(saved ? JSON.parse(saved) : null);
        }
    });
}

// Salvar/Atualizar a decoração da sala (móveis, parede, piso)
export async function updateRoomLayout(roomName, layoutData) {
    const localKey = `${LAYOUT_STORAGE_KEY_PREFIX}${roomName}`;
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(localKey, JSON.stringify(layoutData));
    }

    if (!isFirebaseConfigured || !db) {
        return layoutData;
    }

    const docRef = doc(db, LAYOUT_COLLECTION, roomName);
    await setDoc(docRef, layoutData, { merge: true });
    return layoutData;
}

const INVITATIONS_COLLECTION = 'mundo_invitations';

// Enviar convite para bater papo
export async function sendMundoInvitation(sender, recipient, room) {
    if (!isFirebaseConfigured || !db) return null;
    try {
        const inviteRef = collection(db, INVITATIONS_COLLECTION);
        const docRef = await addDoc(inviteRef, {
            senderId: sender.id || sender.firebaseUid,
            senderNome: sender.nome,
            recipientId: recipient.id || recipient.firebaseUid,
            recipientNome: recipient.nome,
            room,
            status: 'pending',
            reason: '',
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (err) {
        console.error('Erro ao enviar convite:', err);
        return null;
    }
}

// Atualizar status do convite
export async function updateMundoInvitationStatus(inviteId, status, reason = '') {
    if (!isFirebaseConfigured || !db) return;
    try {
        const inviteDocRef = doc(db, INVITATIONS_COLLECTION, inviteId);
        await updateDoc(inviteDocRef, {
            status,
            reason
        });
    } catch (err) {
        console.error('Erro ao atualizar status do convite:', err);
    }
}

// Ouvinte de convites pendentes recebidos pelo usuário logado
export function subscribePendingInvitations(recipientId, onData) {
    if (!isFirebaseConfigured || !db || !recipientId) {
        onData([]);
        return () => {};
    }

    const inviteQuery = query(
        collection(db, INVITATIONS_COLLECTION),
        where('recipientId', '==', recipientId),
        where('status', '==', 'pending')
    );

    return onSnapshot(inviteQuery, (snapshot) => {
        if (snapshot.empty) {
            onData([]);
            return;
        }
        const items = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        }));
        onData(items);
    }, () => {
        onData([]);
    });
}

// Ouvinte de convites enviados pelo usuário logado
export function subscribeSentInvitations(senderId, onData) {
    if (!isFirebaseConfigured || !db || !senderId) {
        onData([]);
        return () => {};
    }

    const inviteQuery = query(
        collection(db, INVITATIONS_COLLECTION),
        where('senderId', '==', senderId)
    );

    return onSnapshot(inviteQuery, (snapshot) => {
        if (snapshot.empty) {
            onData([]);
            return;
        }
        const items = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        }));
        onData(items);
    }, () => {
        onData([]);
    });
}
