# HotelFlow

Aplicacao React + Vite para gerenciamento de solicitacoes internas do hotel.

## Firebase

O projeto ja esta com o SDK do Firebase instalado e com a base de configuracao criada em `src/services/firebase.js`.

### 1. Criar o projeto no Firebase

No [Firebase Console](https://console.firebase.google.com/):

1. Crie um projeto.
2. Ative Authentication.
3. Ative Firestore Database.
4. Crie um app Web dentro do projeto.

### 2. Configurar variaveis de ambiente

1. Duplique `.env.example` para `.env.local`.
2. Preencha as chaves do seu projeto Firebase.

### 3. Base atual do app

Hoje o projeto usa:

- `src/context/AuthContext.jsx`: login com `mockData` + `localStorage`
- `src/context/OSContext.jsx`: ordens em memoria + `localStorage`
- `src/data/mockData.js`: usuarios e ordens iniciais

### 4. Proxima migracao recomendada

1. Migrar autenticacao para Firebase Authentication.
2. Migrar ordens para Firestore.
3. Remover gradualmente `mockData` e persistencia local.

### 5. Rodar o projeto

```bash
npm install
npm run dev
```
