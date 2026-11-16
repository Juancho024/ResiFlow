import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AudioModule } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../../hooks/useAppTheme';

const { width } = Dimensions.get('window');

const slides = [
    {
        id: '1',
        title: 'Bienvenido a ResiFlow',
        description: 'La plataforma unificada de gestión residencial para control total de mantenimiento, gas común y finanzas.',
        icon: 'home-city-outline',
        color: '#3B38F6'
    },
    {
        id: '2',
        title: 'Asistente IA Inteligente',
        description: 'Consulta estados de cuenta, saldos pendientes y genera auditorías o reportes al instante con nuestro módulo inteligente.',
        icon: 'shimmer',
        color: '#6366F1'
    },
    {
        id: '3',
        title: 'Registro y Comandos por Voz',
        description: 'Dicta instrucciones, reporta averías o consulta información clave del condominio utilizando únicamente tu voz.',
        icon: 'mic-outline',
        color: '#0EA5E9'
    },
    {
        id: '4',
        title: 'Escáner de Vouchers',
        description: 'Sube las capturas de tus transferencias o recibos. La IA validará los montos de forma automática para tu tranquilidad.',
        icon: 'camera-outline',
        color: '#10B981'
    },
    {
        id: '5',
        title: 'Mantente Conectado',
        description: 'Para recibir alertas en tiempo real sobre aprobación de pagos, avisos de administración y consumo de gas, habilitaremos los permisos necesarios.',
        icon: 'notifications-outline',
        color: '#F59E0B'
    }
];

export default function Onboarding() {
    const { colors, darkMode } = useAppTheme();
    const [isVisible, setIsVisible] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const checkFirstLaunch = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem('resiflow_has_seen_onboarding');
                if (hasSeen !== 'true') {
                    setIsVisible(true);
                }
            } catch (error) {
                console.log("Error revisando onboarding de ResiFlow", error);
            }
        };
        checkFirstLaunch();
    }, []);

    const handleNext = async () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        } else {
            // 🔥 ÚLTIMA PANTALLA: SOLICITUD DE PERMISOS NATIVOS
            try {
                const { status: notifStatus } = await Notifications.getPermissionsAsync();
                if (notifStatus !== 'granted') {
                    await Notifications.requestPermissionsAsync();
                }
            } catch (e) {
                console.log("Error pidiendo permiso de notificaciones", e);
            }

            try {
                await AudioModule.requestRecordingPermissionsAsync();
            } catch (e) {
                console.log("Error pidiendo permiso de audio", e);
            }

            try {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
            } catch (e) {
                console.log("Error pidiendo permiso de galería", e);
            }

            await AsyncStorage.setItem('resiflow_has_seen_onboarding', 'true');
            setIsVisible(false);
        }
    };

    if (!isVisible) return null;

    const slide = slides[currentSlide];

    return (
        <Modal animationType="fade" transparent={false} visible={isVisible}>
            <View style={[styles.container, { backgroundColor: colors.bg }]}>

                {/* Contenido Central */}
                <View style={styles.content}>
                    <View style={[styles.iconRing, { borderColor: slide.color }]}>
                        <View style={[styles.iconCircle, { backgroundColor: slide.color + '1A' }]}>
                            {slide.icon === 'shimmer' ? (
                                <MaterialCommunityIcons name="shimmer" size={72} color={slide.color} />
                            ) : (
                                <Ionicons name={slide.icon as any} size={72} color={slide.color} />
                            )}
                        </View>
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
                    <Text style={[styles.description, { color: colors.subText }]}>
                        {slide.description}
                    </Text>
                </View>

                {/* Footer con Puntos y Botón */}
                <View style={styles.footer}>
                    {/* Indicadores (Puntitos) */}
                    <View style={styles.pagination}>
                        {slides.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    currentSlide === index
                                        ? [styles.dotActive, { backgroundColor: slide.color }]
                                        : { backgroundColor: darkMode ? '#334155' : '#CBD5E1' }
                                ]}
                            />
                        ))}
                    </View>

                    {/* Botón Siguiente / Finalizar */}
                    <TouchableOpacity
                        style={[styles.btn, { backgroundColor: slide.color }]}
                        activeOpacity={0.85}
                        onPress={handleNext}
                    >
                        <Text style={styles.btnText}>
                            {currentSlide === slides.length - 1 ? '¡Comenzar en ResiFlow!' : 'Siguiente'}
                        </Text>
                        <Ionicons
                            name={currentSlide === slides.length - 1 ? "checkmark-done" : "arrow-forward"}
                            size={18}
                            color="#FFF"
                            style={{ marginLeft: 8 }}
                        />
                    </TouchableOpacity>
                </View>

            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'space-between' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    iconRing: { width: 170, height: 170, borderRadius: 85, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 36 },
    iconCircle: { width: 130, height: 130, borderRadius: 65, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: 0.3 },
    description: { fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
    footer: { paddingHorizontal: 30, paddingBottom: Platform.OS === 'ios' ? 50 : 40 },
    pagination: { flexDirection: 'row', justifyContent: 'center', marginBottom: 28 },
    dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 5 },
    dotActive: { width: 24 },
    btn: { flexDirection: 'row', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    btnText: { color: '#FFF', fontSize: 15, fontWeight: '700' }
});