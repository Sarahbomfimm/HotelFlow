import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OSProvider } from './context/OSContext';
import { NotificationProvider } from './context/NotificationContext';
import { UsersProvider } from './context/UsersContext';
import { ReuniaoProvider } from './context/ReuniaoContext';
import GeminiFloatingButton from './components/GeminiFloatingButton';
import ToastNotifications from './components/ToastNotifications/ToastNotifications';
import AppRouter from './router';

export default function App() {
    return (
        <HashRouter>
            <AuthProvider>
                <UsersProvider>
                    <OSProvider>
                        <ReuniaoProvider>
                            <NotificationProvider>
                                <AppRouter />
                                <GeminiFloatingButton />
                                <ToastNotifications />
                            </NotificationProvider>
                        </ReuniaoProvider>
                    </OSProvider>
                </UsersProvider>
            </AuthProvider>
        </HashRouter>
    );
}
