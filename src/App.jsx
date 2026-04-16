import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OSProvider } from './context/OSContext';
import { NotificationProvider } from './context/NotificationContext';
import { UsersProvider } from './context/UsersContext';
import ToastNotifications from './components/ToastNotifications/ToastNotifications';
import AppRouter from './router';

export default function App() {
    return (
        <HashRouter>
            <AuthProvider>
                <UsersProvider>
                    <OSProvider>
                        <NotificationProvider>
                            <AppRouter />
                            <ToastNotifications />
                        </NotificationProvider>
                    </OSProvider>
                </UsersProvider>
            </AuthProvider>
        </HashRouter>
    );
}
