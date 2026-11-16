import { useState, useEffect } from 'react';
import { PreferencesStore } from '../app/(auth)/login';

export function useAppTheme() {
    const [darkMode, setDarkMode] = useState(PreferencesStore.get().darkMode);

    useEffect(() => {
        return PreferencesStore.subscribe((prefs) => setDarkMode(prefs.darkMode));
    }, []);

    const colors = darkMode
        ? {
            bg: '#0B1120',           // Fondo principal (Deep Navy)
            card: '#1E293B',         // Tarjetas, paneles laterales y modales
            border: '#334155',       // Bordes y separadores sutiles
            text: '#F8FAFC',         // Texto principal (Blanco tiza)
            subText: '#94A3B8',      // Texto secundario (Gris azulado)
            primary: '#6366F1',      // Azul índigo brillante (Destaca mejor en oscuro)
            primarySoft: '#1E1B4B',  // Fondo tenue para acentos azules
            inputBg: '#0F172A',      // Cajas de texto y buscadores
            success: '#22C55E',
            successBg: '#064E3B',
            danger: '#EF4444',
            dangerBg: '#7F1D1D',
            warning: '#F59E0B',
            warningBg: '#78350F',
        }
        : {
            bg: '#F8FAFC',
            card: '#FFFFFF',
            border: '#E2E8F0',
            text: '#0F172A',
            subText: '#64748B',
            primary: '#3B38F6',
            primarySoft: '#EEF2FF',
            inputBg: '#F8FAFC',
            success: '#15803D',
            successBg: '#DCFCE7',
            danger: '#DC2626',
            dangerBg: '#FEE2E2',
            warning: '#B45309',
            warningBg: '#FEF3C7',
        };

    return { darkMode, colors };
}