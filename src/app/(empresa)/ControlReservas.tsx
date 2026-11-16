import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EnterpriseStore, ReservaTrabajo, EmpleadoEmpresa } from './dashboard';

const HORAS_JORNADA = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
];

const NOMBRES_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface DiaSemanaInfo {
    nombreDia: string;
    numeroDia: number;
    mesCorto: string;
    fechaISO: string;
    esHoy: boolean;
}

const obtenerDiasDeLaSemana = (semanaOffset: number): DiaSemanaInfo[] => {
    const hoy = new Date();
    const hoyISO = hoy.toISOString().split('T')[0];

    const base = new Date();
    const diaActual = base.getDay(); // 0 es Domingo
    const diferenciaALunes = base.getDate() - diaActual + (diaActual === 0 ? -6 : 1) + semanaOffset * 7;

    const lunes = new Date(base.setDate(diferenciaALunes));
    const dias: DiaSemanaInfo[] = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        dias.push({
            nombreDia: NOMBRES_DIAS[i],
            numeroDia: d.getDate(),
            mesCorto: MESES_CORTOS[d.getMonth()],
            fechaISO: iso,
            esHoy: iso === hoyISO,
        });
    }
    return dias;
};

export default function ControlReservas() {
    const [reservas, setReservas] = useState<ReservaTrabajo[]>(EnterpriseStore.getReservas());
    const [empleados, setEmpleados] = useState<EmpleadoEmpresa[]>(EnterpriseStore.getEmpleados());
    const [filtro, setFiltro] = useState<string>('TODAS');

    // Control de Semana en el Calendario (0 = esta semana, -1 = anterior, +1 = siguiente)
    const [semanaOffset, setSemanaOffset] = useState(0);
    const diasSemana = obtenerDiasDeLaSemana(semanaOffset);

    // Modal Nueva Reserva
    const [modalVisible, setModalVisible] = useState(false);
    const [residencial, setResidencial] = useState('Residencial Santos I');
    const [idEmpleadoSel, setIdEmpleadoSel] = useState<string>(empleados[0]?.id || 'EMP-1');
    const [tipoServicio, setTipoServicio] = useState<'AVERIA_MECANICA' | 'LIMPIEZA' | 'SUPERVISION' | 'ELECTRICIDAD'>('AVERIA_MECANICA');
    const [fechaSeleccionadaISO, setFechaSeleccionadaISO] = useState<string>(diasSemana[0]?.fechaISO || '');
    const [horaSeleccionada, setHoraSeleccionada] = useState<string>('09:00');
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [pagoManoObra, setPagoManoObra] = useState('1200');
    const [gastoMateriales, setGastoMateriales] = useState('0');

    useEffect(() => {
        return EnterpriseStore.subscribe(() => {
            setReservas([...EnterpriseStore.getReservas()]);
            setEmpleados([...EnterpriseStore.getEmpleados()]);
        });
    }, []);

    const abrirModalEnCasilla = (fechaISO?: string, hora?: string) => {
        setFechaSeleccionadaISO(fechaISO || diasSemana[0].fechaISO);
        setHoraSeleccionada(hora || '09:00');
        const empDefault = empleados[0];
        if (empDefault) {
            setIdEmpleadoSel(empDefault.id);
            setPagoManoObra(String(empDefault.tarifaBase));
        }
        setTitulo('');
        setDescripcion('');
        setGastoMateriales('0');
        setModalVisible(true);
    };

    const crearReserva = () => {
        const emp = empleados.find((e) => e.id === idEmpleadoSel) || empleados[0];
        const tituloFinal =
            titulo.trim() ||
            `${tipoServicio.replace('_', ' ')} en ${residencial}`;

        EnterpriseStore.agregarReserva({
            id: String(Date.now()),
            codigo: `ORD-${Math.floor(904 + Math.random() * 90)}`,
            residencial,
            idEmpleado: emp.id,
            nombreEmpleado: emp.nombre,
            rolEmpleado: emp.rol,
            tipoServicio,
            titulo: tituloFinal,
            descripcion: descripcion.trim() || 'Asignación programada en horario semanal.',
            fechaISO: fechaSeleccionadaISO,
            hora: horaSeleccionada,
            fechaHora: `${fechaSeleccionadaISO} • ${horaSeleccionada}`,
            pagoManoObra: parseFloat(pagoManoObra) || emp.tarifaBase,
            gastoMateriales: parseFloat(gastoMateriales) || 0,
            checkInGps: false,
            evidenciaFotos: false,
            estado: 'PENDIENTE',
        });

        setTitulo('');
        setDescripcion('');
        setModalVisible(false);
    };

    const obtenerColorServicio = (tipo: ReservaTrabajo['tipoServicio']) => {
        switch (tipo) {
            case 'AVERIA_MECANICA':
                return { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' };
            case 'LIMPIEZA':
                return { bg: '#EEF2FF', border: '#3B38F6', text: '#1E40AF' };
            case 'SUPERVISION':
                return { bg: '#DCFCE7', border: '#10B981', text: '#065F46' };
            case 'ELECTRICIDAD':
                return { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' };
        }
    };

    const filtradas = reservas.filter((r) => filtro === 'TODAS' || r.estado === filtro);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* CABECERA */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.pageTitle}>Horario Semanal de Reservas y Órdenes</Text>
                    <Text style={styles.pageSub}>
                        Haz clic en cualquier hora del calendario para agendar un mecánico, limpieza o supervisión.
                    </Text>
                </View>
                <TouchableOpacity style={styles.newBtn} onPress={() => abrirModalEnCasilla()}>
                    <Feather name="plus-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.newBtnText}>Nueva Reserva / Orden</Text>
                </TouchableOpacity>
            </View>

            {/* ==================================================================== */}
            {/* CALENDARIO / HORARIO SEMANAL POR DÍA Y HORA                          */}
            {/* ==================================================================== */}
            <View style={styles.calendarCard}>
                <View style={styles.calendarTopBar}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={styles.calIconBox}>
                            <Feather name="calendar" size={18} color="#3B38F6" />
                        </View>
                        <View>
                            <Text style={styles.calendarTitle}>
                                Semana del {diasSemana[0].numeroDia} {diasSemana[0].mesCorto} al{' '}
                                {diasSemana[6].numeroDia} {diasSemana[6].mesCorto}
                            </Text>
                            <Text style={styles.calendarSub}>
                                Turnos organizados por día y hora • Clic en una celda para programar
                            </Text>
                        </View>
                    </View>

                    <View style={styles.weekNavGroup}>
                        <TouchableOpacity
                            style={styles.weekNavBtn}
                            onPress={() => setSemanaOffset((prev) => prev - 1)}
                        >
                            <Feather name="chevron-left" size={16} color="#0F172A" />
                            <Text style={styles.weekNavTxt}>Anterior</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.weekNavBtn, semanaOffset === 0 && styles.weekNavBtnToday]}
                            onPress={() => setSemanaOffset(0)}
                        >
                            <Text style={[styles.weekNavTxt, semanaOffset === 0 && { color: '#3B38F6', fontWeight: '800' }]}>
                                Esta Semana
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.weekNavBtn}
                            onPress={() => setSemanaOffset((prev) => prev + 1)}
                        >
                            <Text style={styles.weekNavTxt}>Siguiente</Text>
                            <Feather name="chevron-right" size={16} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* GRILLA HORARIA CON SCROLL HORIZONTAL EN PANTALLAS PEQUEÑAS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={styles.scheduleTable}>
                        {/* ENCABEZADO DE LOS 7 DÍAS */}
                        <View style={styles.scheduleHeaderRow}>
                            <View style={styles.hourHeaderCell}>
                                <Text style={styles.hourHeaderText}>HORA</Text>
                            </View>
                            {diasSemana.map((d) => (
                                <View
                                    key={d.fechaISO}
                                    style={[styles.dayHeaderCell, d.esHoy && styles.dayHeaderCellToday]}
                                >
                                    <Text style={[styles.dayNameText, d.esHoy && { color: '#3B38F6' }]}>
                                        {d.nombreDia.toUpperCase()}
                                    </Text>
                                    <Text style={[styles.dayNumberText, d.esHoy && { color: '#3B38F6' }]}>
                                        {d.numeroDia} {d.mesCorto}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* FILAS POR CADA HORA (08:00 a 17:00) */}
                        {HORAS_JORNADA.map((horaStr) => (
                            <View key={horaStr} style={styles.scheduleBodyRow}>
                                {/* Columna de Hora */}
                                <View style={styles.hourCell}>
                                    <Text style={styles.hourCellText}>{horaStr}</Text>
                                </View>

                                {/* 7 Celdas de Días */}
                                {diasSemana.map((dia) => {
                                    const reservasEnCelda = reservas.filter(
                                        (r) => r.fechaISO === dia.fechaISO && r.hora === horaStr
                                    );
                                    return (
                                        <TouchableOpacity
                                            key={`${dia.fechaISO}-${horaStr}`}
                                            style={[styles.slotCell, dia.esHoy && { backgroundColor: '#F8FAFF' }]}
                                            activeOpacity={0.75}
                                            onPress={() => abrirModalEnCasilla(dia.fechaISO, horaStr)}
                                        >
                                            {reservasEnCelda.map((ev) => {
                                                const colores = obtenerColorServicio(ev.tipoServicio);
                                                return (
                                                    <View
                                                        key={ev.id}
                                                        style={[
                                                            styles.eventBlock,
                                                            {
                                                                backgroundColor: colores.bg,
                                                                borderLeftColor: colores.border,
                                                            },
                                                        ]}
                                                    >
                                                        <Text style={[styles.eventCode, { color: colores.text }]}>
                                                            {ev.codigo} • {ev.residencial}
                                                        </Text>
                                                        <Text
                                                            style={[styles.eventTitle, { color: colores.text }]}
                                                            numberOfLines={1}
                                                        >
                                                            {ev.titulo}
                                                        </Text>
                                                        <Text style={styles.eventWorker} numberOfLines={1}>
                                                            👷 {ev.nombreEmpleado.split(' ')[0]} ({ev.estado.replace('_', ' ')})
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* FILTROS Y DETALLE DE ÓRDENES DE TRABAJO */}
            <View style={{ marginTop: 8 }}>
                <Text style={styles.sectionSubHeader}>LISTADO DETALLADO Y VALIDACIÓN PARA NÓMINA</Text>
                <View style={styles.pillsRow}>
                    {['TODAS', 'PENDIENTE', 'EN_PROCESO', 'VALIDADO_SUPERVISOR', 'PAGADO'].map((est) => (
                        <TouchableOpacity
                            key={est}
                            style={[styles.pill, filtro === est && styles.pillActive]}
                            onPress={() => setFiltro(est)}
                        >
                            <Text style={[styles.pillText, filtro === est && { color: '#FFFFFF' }]}>
                                {est.replace('_', ' ')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ gap: 14 }}>
                    {filtradas.map((r) => {
                        const puedeValidar = r.estado === 'PENDIENTE' || r.estado === 'EN_PROCESO';
                        return (
                            <View key={r.id} style={styles.card}>
                                <View style={styles.cardTop}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={styles.codeBox}>
                                            <Text style={styles.codeText}>{r.codigo}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.resName}>{r.residencial}</Text>
                                            <Text style={styles.resDate}>
                                                📅 {r.fechaISO} a las {r.hora} • {r.tipoServicio.replace('_', ' ')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.statusPill}>
                                        <Text style={styles.statusPillText}>{r.estado.replace('_', ' ')}</Text>
                                    </View>
                                </View>

                                <Text style={styles.orderTitle}>{r.titulo}</Text>
                                <Text style={styles.orderDesc}>{r.descripcion}</Text>

                                <View style={styles.detailsGrid}>
                                    <View style={{ flex: 1.2 }}>
                                        <Text style={styles.lbl}>Técnico / Responsable</Text>
                                        <Text style={styles.val}>{r.nombreEmpleado} ({r.rolEmpleado})</Text>
                                    </View>
                                    <View style={{ flex: 0.8 }}>
                                        <Text style={styles.lbl}>Mano de Obra</Text>
                                        <Text style={[styles.val, { color: '#15803D' }]}>
                                            RD$ {r.pagoManoObra.toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 0.8 }}>
                                        <Text style={styles.lbl}>Materiales (Reembolso)</Text>
                                        <Text style={styles.val}>RD$ {r.gastoMateriales.toLocaleString()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.lbl}>Auditoría de Campo</Text>
                                        <Text style={styles.val}>
                                            {r.checkInGps ? '✓ GPS OK' : '⏳ GPS'} •{' '}
                                            {r.evidenciaFotos ? '✓ Fotos OK' : '⏳ Fotos'}
                                        </Text>
                                    </View>
                                </View>

                                {puedeValidar && (
                                    <TouchableOpacity
                                        style={styles.approveBtn}
                                        onPress={() => EnterpriseStore.validarReserva(r.id)}
                                    >
                                        <Feather name="check-circle" size={16} color="#FFFFFF" />
                                        <Text style={styles.approveBtnText}>
                                            Validar Trabajo Terminado y Acreditar RD${' '}
                                            {(r.pagoManoObra + r.gastoMateriales).toLocaleString()} a Nómina
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* ==================================================================== */}
            {/* MODAL CORREGIDO (CABECERA Y BOTONES INFERIORES SIEMPRE VISIBLES)     */}
            {/* ==================================================================== */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        {/* CABECERA FIJA */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Programar Reserva / Orden de Trabajo</Text>
                                <Text style={styles.modalSub}>
                                    Fecha seleccionada: {fechaSeleccionadaISO} a las {horaSeleccionada}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* CUERPO CON SCROLL INTERNO CONTROLADO */}
                        <ScrollView
                            style={styles.modalScrollBody}
                            contentContainerStyle={{ paddingBottom: 10 }}
                            showsVerticalScrollIndicator={true}
                        >
                            <Text style={styles.label}>1. Día de la Semana</Text>
                            <View style={styles.compactPillsWrap}>
                                {diasSemana.map((d) => (
                                    <TouchableOpacity
                                        key={d.fechaISO}
                                        style={[
                                            styles.pillCompact,
                                            fechaSeleccionadaISO === d.fechaISO && styles.pillActive,
                                        ]}
                                        onPress={() => setFechaSeleccionadaISO(d.fechaISO)}
                                    >
                                        <Text
                                            style={[
                                                styles.pillText,
                                                fechaSeleccionadaISO === d.fechaISO && { color: '#FFFFFF' },
                                            ]}
                                        >
                                            {d.nombreDia} {d.numeroDia}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>2. Hora del Servicio</Text>
                            <View style={styles.compactPillsWrap}>
                                {HORAS_JORNADA.map((h) => (
                                    <TouchableOpacity
                                        key={h}
                                        style={[
                                            styles.pillCompact,
                                            horaSeleccionada === h && styles.pillActive,
                                        ]}
                                        onPress={() => setHoraSeleccionada(h)}
                                    >
                                        <Text
                                            style={[
                                                styles.pillText,
                                                horaSeleccionada === h && { color: '#FFFFFF' },
                                            ]}
                                        >
                                            {h}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>3. Residencial Destino</Text>
                            <View style={styles.compactPillsWrap}>
                                {['Residencial Santos I', 'Residencial Las Acacias', 'Torre Mirador'].map((res) => (
                                    <TouchableOpacity
                                        key={res}
                                        style={[styles.pillCompact, residencial === res && styles.pillActive]}
                                        onPress={() => setResidencial(res)}
                                    >
                                        <Text style={[styles.pillText, residencial === res && { color: '#FFFFFF' }]}>
                                            {res}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>4. Tipo de Intervención</Text>
                            <View style={styles.compactPillsWrap}>
                                {(['AVERIA_MECANICA', 'LIMPIEZA', 'SUPERVISION', 'ELECTRICIDAD'] as const).map((t) => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[styles.pillCompact, tipoServicio === t && styles.pillActive]}
                                        onPress={() => setTipoServicio(t)}
                                    >
                                        <Text style={[styles.pillText, tipoServicio === t && { color: '#FFFFFF' }]}>
                                            {t.replace('_', ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>5. Asignar Empleado / Técnico</Text>
                            <View style={styles.compactPillsWrap}>
                                {empleados.map((e) => (
                                    <TouchableOpacity
                                        key={e.id}
                                        style={[styles.pillCompact, idEmpleadoSel === e.id && styles.pillActive]}
                                        onPress={() => {
                                            setIdEmpleadoSel(e.id);
                                            setPagoManoObra(String(e.tarifaBase));
                                        }}
                                    >
                                        <Text style={[styles.pillText, idEmpleadoSel === e.id && { color: '#FFFFFF' }]}>
                                            {e.nombre} ({e.rol})
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Título del Trabajo (Opcional, se autogenera si lo dejas vacío)</Text>
                            <TextInput
                                style={styles.input}
                                value={titulo}
                                onChangeText={setTitulo}
                                placeholder="Ej: Reparación de flotador cisterna"
                            />

                            <Text style={styles.label}>Instrucciones Específicas</Text>
                            <TextInput
                                style={styles.input}
                                value={descripcion}
                                onChangeText={setDescripcion}
                                placeholder="Detalles para el técnico..."
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Pago Mano de Obra (RD$)</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        value={pagoManoObra}
                                        onChangeText={setPagoManoObra}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Materiales Reembolso (RD$)</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        value={gastoMateriales}
                                        onChangeText={setGastoMateriales}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* PIE DE MODAL FIJO (NUNCA SE CORTA) */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={crearReserva}>
                                <Feather name="check" size={16} color="#FFFFFF" />
                                <Text style={styles.saveBtnText}>Despachar Orden al Horario</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 24, paddingBottom: 48, gap: 18 },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    pageSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    newBtn: {
        backgroundColor: '#3B38F6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

    /* ESTILOS DEL CALENDARIO SEMANAL */
    calendarCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    calendarTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    calIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    calendarSub: { fontSize: 12, color: '#64748B' },
    weekNavGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    weekNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    weekNavBtnToday: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
    weekNavTxt: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    scheduleTable: {
        minWidth: 980,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        overflow: 'hidden',
    },
    scheduleHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    hourHeaderCell: {
        width: 74,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    hourHeaderText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
    dayHeaderCell: {
        flex: 1,
        minWidth: 128,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    dayHeaderCellToday: { backgroundColor: '#EEF2FF' },
    dayNameText: { fontSize: 11, fontWeight: '800', color: '#475569' },
    dayNumberText: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 2 },
    scheduleBodyRow: {
        flexDirection: 'row',
        minHeight: 64,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    hourCell: {
        width: 74,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    hourCellText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
    slotCell: {
        flex: 1,
        minWidth: 128,
        padding: 4,
        borderRightWidth: 1,
        borderRightColor: '#F1F5F9',
        gap: 4,
    },
    eventBlock: {
        borderRadius: 6,
        padding: 6,
        borderLeftWidth: 3,
    },
    eventCode: { fontSize: 9, fontWeight: '800' },
    eventTitle: { fontSize: 11, fontWeight: '800', marginTop: 1 },
    eventWorker: { fontSize: 10, color: '#475569', marginTop: 2, fontWeight: '600' },

    /* LISTADO INFERIOR */
    sectionSubHeader: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pillCompact: {
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    pillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    pillText: { fontSize: 11, fontWeight: '800', color: '#475569' },
    compactPillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    codeBox: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    codeText: { color: '#3B38F6', fontSize: 12, fontWeight: '800' },
    resName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    resDate: { fontSize: 11, color: '#64748B' },
    statusPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusPillText: { fontSize: 11, fontWeight: '800', color: '#334155' },
    orderTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 4 },
    orderDesc: { fontSize: 13, color: '#475569', marginTop: 2, marginBottom: 14 },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        gap: 12,
    },
    lbl: { fontSize: 11, color: '#64748B' },
    val: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 2 },
    approveBtn: {
        marginTop: 14,
        backgroundColor: '#15803D',
        paddingVertical: 12,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    approveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

    /* MODAL CON CABECERA Y PIE FIJOS */
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 540,
        maxHeight: '88%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        marginBottom: 12,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    modalSub: { fontSize: 12, color: '#3B38F6', fontWeight: '700', marginTop: 2 },
    modalScrollBody: {
        flexGrow: 0,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 10,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        marginTop: 8,
    },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        height: 40,
        paddingHorizontal: 12,
        fontSize: 13,
        marginBottom: 10,
        outlineStyle: 'none',
    } as any,
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    saveBtn: {
        flex: 1.6,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#3B38F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    saveBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});