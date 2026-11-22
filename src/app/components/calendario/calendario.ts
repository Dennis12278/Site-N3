import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { SessaoService } from '../../services/sessao.service';

type Visao = 'dia' | 'semana' | 'mes';

interface Evento {
  id: number;
  titulo: string;
  detalhes: string;
  inicio: Date;
  fim: Date;
}

interface Rascunho {
  id: number | null;
  titulo: string;
  detalhes: string;
  data: string;
  horaInicio: string;
  horaFim: string;
}

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const NOMES_DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'];

const LETRAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// feriados nacionais fixos (mês-dia)
const FERIADOS_FIXOS: { data: string; nome: string }[] = [
  { data: '01-01', nome: 'Confraternização Universal' },
  { data: '04-21', nome: 'Tiradentes' },
  { data: '05-01', nome: 'Dia do Trabalho' },
  { data: '09-07', nome: 'Independência do Brasil' },
  { data: '10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '11-02', nome: 'Finados' },
  { data: '11-15', nome: 'Proclamação da República' },
  { data: '11-20', nome: 'Dia da Consciência Negra' },
  { data: '12-25', nome: 'Natal' }
];

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendario.html',
  styleUrl: './calendario.css'
})
export class Calendario implements OnInit {

  horas: number[] = Array.from({ length: 24 }, (_, i) => i);

  letrasSemana = LETRAS_SEMANA;

  // 1 minuto = 1 pixel (cada hora tem 60px)
  readonly pxPorMinuto = 1;

  dataSelecionada = new Date();

  // mês mostrado no calendário pequeno (à esquerda)
  mesMini = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  visao: Visao = 'semana';

  eventos: Evento[] = [];

  modalAberto = false;

  rascunho: Rascunho = this.novoRascunho(new Date());

  // feriados: ligado ou desligado pelo botão (fica salvo no navegador)
  mostrarFeriados = false;

  constructor(
    private apiService: ApiService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.mostrarFeriados = localStorage.getItem('dream_feriados') === 'sim';
    this.carregarEventos();
  }

  // ===== FERIADOS =====

  alternarFeriados(): void {
    this.mostrarFeriados = !this.mostrarFeriados;
    localStorage.setItem('dream_feriados', this.mostrarFeriados ? 'sim' : 'nao');
  }

  feriadoDoDia(d: Date): string | null {

    if (!this.mostrarFeriados) {
      return null;
    }

    const mesDia = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const feriado = FERIADOS_FIXOS.find(f => f.data === mesDia);

    return feriado ? feriado.nome : null;

  }

  temFeriado(d: Date): boolean {
    return this.feriadoDoDia(d) !== null;
  }

  // ===== DADOS =====

  carregarEventos(): void {

    const usuario = SessaoService.usuario();

    if (!usuario) {
      return;
    }

    this.apiService.listarCalendario(usuario.id).subscribe({

      next: itens => {

        this.eventos = itens.map(item => {

          const inicio = new Date(item.data);
          const fim = item.dataFim
            ? new Date(item.dataFim)
            : new Date(inicio.getTime() + 30 * 60000);

          return {
            id: item.id,
            titulo: item.descricao,
            detalhes: item.detalhes ?? '',
            inicio,
            fim
          };

        });

        this.changeDetectorRef.detectChanges();

      },

      error: erro => console.error('Erro ao carregar calendário:', erro)

    });

  }

  // ===== DATAS =====

  private inicioDoDia(d: Date): Date {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  private inicioDaSemana(d: Date): Date {
    // a semana começa na segunda-feira
    const r = this.inicioDoDia(d);
    const dia = r.getDay();
    r.setDate(r.getDate() - (dia === 0 ? 6 : dia - 1));
    return r;
  }

  private mesmoDia(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  ehHoje(d: Date): boolean {
    return this.mesmoDia(d, new Date());
  }

  ehSelecionado(d: Date): boolean {
    return this.mesmoDia(d, this.dataSelecionada);
  }

  nomeDia(d: Date): string {
    return NOMES_DIAS[d.getDay()];
  }

  hora(d: Date): string {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  get diasVisiveis(): Date[] {

    if (this.visao === 'dia') {
      return [this.inicioDoDia(this.dataSelecionada)];
    }

    const inicio = this.inicioDaSemana(this.dataSelecionada);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });

  }

  get textoPeriodo(): string {

    if (this.visao === 'mes') {
      return `${NOMES_MESES[this.dataSelecionada.getMonth()]} de ${this.dataSelecionada.getFullYear()}`;
    }

    const dias = this.diasVisiveis;
    const primeiro = dias[0];
    const ultimo = dias[dias.length - 1];

    if (this.visao === 'dia') {
      return `${primeiro.getDate()} de ${NOMES_MESES[primeiro.getMonth()]} de ${primeiro.getFullYear()}`;
    }

    return `${primeiro.getDate()} – ${ultimo.getDate()} de ${NOMES_MESES[ultimo.getMonth()]} de ${ultimo.getFullYear()}`;

  }

  // ===== CALENDÁRIO PEQUENO (à esquerda) =====

  get nomeMesMini(): string {
    return NOMES_MESES[this.mesMini.getMonth()];
  }

  get anoMesMini(): number {
    return this.mesMini.getFullYear();
  }

  get diasMini(): Date[] {

    const primeiro = new Date(this.mesMini.getFullYear(), this.mesMini.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });

  }

  moverMiniMes(direcao: number): void {
    const m = new Date(this.mesMini);
    m.setMonth(m.getMonth() + direcao);
    this.mesMini = m;
  }

  selecionarDia(d: Date): void {
    this.dataSelecionada = new Date(d);
    this.mesMini = new Date(d.getFullYear(), d.getMonth(), 1);
  }

  // ===== NAVEGAÇÃO =====

  hoje(): void {
    this.selecionarDia(new Date());
  }

  mover(direcao: number): void {

    const d = new Date(this.dataSelecionada);

    if (this.visao === 'mes') {
      d.setMonth(d.getMonth() + direcao);
    } else if (this.visao === 'dia') {
      d.setDate(d.getDate() + direcao);
    } else {
      d.setDate(d.getDate() + direcao * 7);
    }

    this.selecionarDia(d);

  }

  // ===== EVENTOS NA GRADE =====

  eventosDoDia(d: Date): Evento[] {
    return this.eventos
      .filter(e => this.mesmoDia(e.inicio, d))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  }

  estiloEvento(e: Evento): { [chave: string]: string } {

    const minutos = e.inicio.getHours() * 60 + e.inicio.getMinutes();
    const duracao = Math.max(30, (e.fim.getTime() - e.inicio.getTime()) / 60000);

    return {
      top: minutos * this.pxPorMinuto + 'px',
      height: duracao * this.pxPorMinuto + 'px'
    };

  }

  // ===== MODAL: NOVO / EDITAR EVENTO =====

  private dataIso(d: Date): string {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  private horaIso(d: Date): string {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  private novoRascunho(inicio: Date): Rascunho {

    const fim = new Date(inicio.getTime() + 60 * 60000);

    return {
      id: null,
      titulo: '',
      detalhes: '',
      data: this.dataIso(inicio),
      horaInicio: this.horaIso(inicio),
      horaFim: this.horaIso(fim)
    };

  }

  proximaHora(): number {
    return Math.min(new Date().getHours() + 1, 23);
  }

  novoEventoEm(d: Date, hora: number): void {

    const inicio = new Date(d);
    inicio.setHours(hora, 0, 0, 0);

    this.rascunho = this.novoRascunho(inicio);
    this.modalAberto = true;

  }

  editarEvento(e: Evento, evento: Event): void {

    evento.stopPropagation();

    this.rascunho = {
      id: e.id,
      titulo: e.titulo,
      detalhes: e.detalhes,
      data: this.dataIso(e.inicio),
      horaInicio: this.horaIso(e.inicio),
      horaFim: this.horaIso(e.fim)
    };

    this.modalAberto = true;

  }

  fecharModal(): void {
    this.modalAberto = false;
  }

  private combinar(data: string, hora: string): Date {
    return new Date(data + 'T' + hora + ':00');
  }

  salvarEvento(): void {

    const usuario = SessaoService.usuario();

    if (!usuario) {
      return;
    }

    if (this.rascunho.titulo.trim() === '') {
      alert('Dê um título ao evento.');
      return;
    }

    const inicio = this.combinar(this.rascunho.data, this.rascunho.horaInicio);
    const fim = this.combinar(this.rascunho.data, this.rascunho.horaFim);

    if (fim.getTime() <= inicio.getTime()) {
      alert('A hora de término precisa ser depois do início.');
      return;
    }

    const dados: any = {
      idUsuario: usuario.id,
      data: inicio.toISOString(),
      dataFim: fim.toISOString(),
      descricao: this.rascunho.titulo.trim(),
      detalhes: this.rascunho.detalhes
    };

    const chamada = this.rascunho.id !== null
      ? this.apiService.editarCalendario({ ...dados, id: this.rascunho.id })
      : this.apiService.criarCalendario(dados);

    chamada.subscribe({

      next: () => {
        this.modalAberto = false;
        this.carregarEventos();
      },

      error: erro => {
        console.error('Erro ao salvar evento:', erro);
        alert('Não foi possível salvar o evento.');
      }

    });

  }

  excluirEvento(): void {

    if (this.rascunho.id === null) {
      return;
    }

    if (!confirm('Excluir este evento?')) {
      return;
    }

    this.apiService.excluirCalendario(this.rascunho.id).subscribe({

      next: () => {
        this.modalAberto = false;
        this.carregarEventos();
      },

      error: erro => {
        console.error('Erro ao excluir evento:', erro);
        alert('Não foi possível excluir o evento.');
      }

    });

  }

}
