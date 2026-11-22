import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../services/api.service';
import { SessaoService } from '../../services/sessao.service';

interface ItemColecaoLeitura {
  id: number;
  titulo: string;
  nomeUsuario: string;
  dataPublicacao: string | null;
}

type PainelLeitor = 'colecao' | 'config' | 'ajuda' | null;

@Component({
  selector: 'app-leitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leitor.html',
  styleUrl: './leitor.css'
})
export class Leitor implements OnInit, OnDestroy {

  id = 0;

  // coleção de onde o leitor foi aberto (para navegar entre os títulos)
  idColecao: number | null = null;
  tituloColecao = '';
  itensColecao: ItemColecaoLeitura[] = [];
  posicaoAtual = -1;

  publicacao: any = null;

  carregando = true;

  semArquivo = false;

  tipo = '';

  pdfUrl: SafeResourceUrl | null = null;

  textoTxt = '';

  // progresso (0 a 100)
  progresso = 0;

  private progressoEnviado = 0;

  private timer: any = null;

  // barra do topo e lateral: some com um clique (simples ou duplo, nas configurações)
  barraVisivel = true;

  // painel aberto: lista da coleção, configurações ou ajuda
  painelAberto: PainelLeitor = null;

  // configurações do leitor
  modoOcultar: 'simples' | 'duplo' = 'duplo';

  // filtros do painel da coleção
  pesquisaColecao = '';
  filtroUsuario = 'todos';
  ordenacaoPainel: 'titulo' | 'data' = 'titulo';

  // envio de arquivo (só para o dono)
  arquivoSelecionado: File | null = null;

  enviandoArquivo = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private changeDetectorRef: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {

    // o mesmo componente é reaproveitado ao trocar de título, então reage às mudanças da rota
    this.route.paramMap.subscribe(parametros => {

      const novoId = Number(parametros.get('id'));

      if (!novoId) {
        this.carregando = false;
        return;
      }

      this.iniciarTitulo(novoId);

    });

    // salva o progresso a cada 10 segundos
    this.timer = setInterval(() => this.enviarProgresso(), 10000);

    // lembra a escolha de ocultar a barra
    const salvo = localStorage.getItem('dream_ocultar_barra');
    this.modoOcultar = salvo === 'simples' ? 'simples' : 'duplo';

  }

  private iniciarTitulo(novoId: number): void {

    // guarda o progresso do título anterior antes de trocar
    this.enviarProgresso();

    this.id = novoId;
    this.publicacao = null;
    this.carregando = true;
    this.semArquivo = false;
    this.tipo = '';
    this.pdfUrl = null;
    this.textoTxt = '';
    this.progresso = 0;
    this.progressoEnviado = 0;
    this.arquivoSelecionado = null;

    const colecao = this.route.snapshot.queryParamMap.get('colecao');

    this.idColecao = colecao ? Number(colecao) : null;

    if (this.idColecao) {
      this.carregarColecao(this.idColecao);
    } else {
      this.itensColecao = [];
      this.posicaoAtual = -1;
    }

    this.carregarPublicacao();

    window.scrollTo(0, 0);

  }

  get souDono(): boolean {

    const usuario = SessaoService.usuario();

    return !!usuario && !!this.publicacao && usuario.id === this.publicacao.idUsuario;

  }

  // ===== navegação entre títulos da coleção =====

  carregarColecao(idColecao: number): void {

    const usuario = SessaoService.usuario();

    this.apiService.obterColecaoPublica(idColecao, usuario ? usuario.id : 0).subscribe({

      next: colecao => {

        this.tituloColecao = colecao.titulo ?? '';

        this.itensColecao = (colecao.itens ?? []).map((item: any) => ({
          id: item.id,
          titulo: item.titulo,
          nomeUsuario: item.nomeUsuario ?? '',
          dataPublicacao: item.dataPublicacao ?? null
        }));

        this.posicaoAtual = this.itensColecao.findIndex(item => item.id === this.id);

        this.changeDetectorRef.detectChanges();

      },

      error: erro => console.error('Erro ao carregar coleção:', erro)

    });

  }

  get temColecao(): boolean {
    return this.idColecao !== null && this.posicaoAtual >= 0;
  }

  get tituloAnterior(): ItemColecaoLeitura | null {
    return this.posicaoAtual > 0 ? this.itensColecao[this.posicaoAtual - 1] : null;
  }

  get proximoTitulo(): ItemColecaoLeitura | null {
    return this.posicaoAtual < this.itensColecao.length - 1
      ? this.itensColecao[this.posicaoAtual + 1]
      : null;
  }

  irParaTitulo(item: ItemColecaoLeitura | null): void {

    if (!item || !this.idColecao) {
      return;
    }

    this.router.navigate(['/leitor', item.id], {
      queryParams: { colecao: this.idColecao }
    });

  }

  // ===== carregamento da publicação e do arquivo =====

  carregarPublicacao(): void {

    this.apiService.obterDocumento(this.id).subscribe({

      next: documento => {

        this.publicacao = documento;
        this.carregando = false;
        this.semArquivo = !documento.arquivoLeitura;

        if (documento.arquivoLeitura) {
          this.carregarArquivo();
        }

        this.changeDetectorRef.detectChanges();

      },

      error: erro => {

        console.error('Erro ao buscar publicação:', erro);

        this.carregando = false;
        this.changeDetectorRef.detectChanges();

      }

    });

  }

  carregarArquivo(): void {

    this.tipo = this.publicacao.tipoArquivo ?? 'txt';

    this.apiService.obterArquivoLeitura(this.id).subscribe({

      next: arquivo => {

        if (this.tipo === 'pdf') {

          // o navegador mostra o PDF pelo visualizador próprio
          const url = URL.createObjectURL(arquivo);
          this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

        } else {

          arquivo.text().then(texto => {
            this.textoTxt = texto;
            this.changeDetectorRef.detectChanges();
          });

        }

        this.changeDetectorRef.detectChanges();

      },

      error: erro => {

        console.error('Erro ao carregar arquivo:', erro);
        alert('Não foi possível abrir o arquivo.');

      }

    });

  }

  // ===== rolagem: progresso do TXT =====

  @HostListener('window:scroll')
  aoRolar(): void {

    const posicao = window.scrollY;

    if (this.tipo !== 'txt') {
      return;
    }

    const total = document.documentElement.scrollHeight - window.innerHeight;

    if (total <= 0) {
      return;
    }

    const porcentagem = Math.round((posicao / total) * 100);

    if (porcentagem > this.progresso) {
      this.progresso = Math.min(porcentagem, 100);
    }

  }

  // ===== painéis (coleção, configurações, ajuda) =====

  abrirPainel(painel: PainelLeitor): void {
    this.painelAberto = painel;
  }

  fecharPainel(): void {
    this.painelAberto = null;
  }

  // ===== ocultar a barra com um clique (simples ou duplo) =====

  private clicouEmControle(evento: Event): boolean {

    const alvo = evento.target as HTMLElement;

    return !!alvo.closest('button, a, input, textarea, select, iframe, label, .painel-leitor');

  }

  cliqueConteudo(evento: MouseEvent): void {

    if (this.painelAberto || this.clicouEmControle(evento)) {
      return;
    }

    if (this.modoOcultar === 'simples') {
      this.barraVisivel = !this.barraVisivel;
    }

  }

  duploCliqueConteudo(evento: MouseEvent): void {

    if (this.painelAberto || this.clicouEmControle(evento)) {
      return;
    }

    if (this.modoOcultar === 'duplo') {
      this.barraVisivel = !this.barraVisivel;
    }

  }

  definirModoOcultar(modo: 'simples' | 'duplo'): void {

    this.modoOcultar = modo;
    localStorage.setItem('dream_ocultar_barra', modo);

  }

  // ===== lista de títulos da coleção (painel) =====

  get autoresColecao(): string[] {

    const nomes = this.itensColecao
      .map(item => item.nomeUsuario)
      .filter(nome => nome !== '');

    return Array.from(new Set(nomes));

  }

  get itensPainel(): ItemColecaoLeitura[] {

    let lista = [...this.itensColecao];

    const texto = this.pesquisaColecao.trim().toLowerCase();

    if (texto !== '') {
      lista = lista.filter(item => item.titulo.toLowerCase().includes(texto));
    }

    if (this.filtroUsuario !== 'todos') {
      lista = lista.filter(item => item.nomeUsuario === this.filtroUsuario);
    }

    if (this.ordenacaoPainel === 'titulo') {
      lista.sort((a, b) => a.titulo.localeCompare(b.titulo));
    } else {
      lista.sort((a, b) =>
        new Date(b.dataPublicacao ?? 0).getTime() - new Date(a.dataPublicacao ?? 0).getTime()
      );
    }

    return lista;

  }

  tempoAtras(data: string | null): string {

    if (!data) {
      return '';
    }

    const minutos = Math.floor((Date.now() - new Date(data).getTime()) / 60000);

    if (minutos < 60) {
      return minutos < 1 ? 'agora' : minutos + ' min atrás';
    }

    const horas = Math.floor(minutos / 60);

    if (horas < 24) {
      return horas + (horas === 1 ? ' hora atrás' : ' horas atrás');
    }

    const dias = Math.floor(horas / 24);

    return dias + (dias === 1 ? ' dia atrás' : ' dias atrás');

  }

  // ===== PDF e progresso =====

  // PDF: o navegador não informa a rolagem, então o usuário marca como concluída
  concluirLeitura(): void {

    this.progresso = 100;
    this.enviarProgresso();

  }

  private enviarProgresso(): void {

    const usuario = SessaoService.usuario();

    if (!usuario || !this.id || this.progresso <= this.progressoEnviado) {
      return;
    }

    this.progressoEnviado = this.progresso;

    this.apiService.atualizarProgressoLeitura(usuario.id, this.id, this.progresso).subscribe({
      error: erro => console.error('Erro ao salvar progresso:', erro)
    });

  }

  // ===== envio do arquivo (só o dono) =====

  aoEscolherArquivo(evento: Event): void {

    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0] ?? null;

    if (arquivo) {

      const nome = arquivo.name.toLowerCase();

      if (!nome.endsWith('.pdf') && !nome.endsWith('.txt')) {
        alert('Envie um arquivo PDF ou TXT.');
        input.value = '';
        this.arquivoSelecionado = null;
        return;
      }

    }

    this.arquivoSelecionado = arquivo;

  }

  enviarArquivo(): void {

    const usuario = SessaoService.usuario();

    if (!usuario || !this.arquivoSelecionado) {
      return;
    }

    this.enviandoArquivo = true;

    this.apiService.enviarArquivoLeitura(this.id, usuario.id, this.arquivoSelecionado).subscribe({

      next: () => {

        this.enviandoArquivo = false;
        this.arquivoSelecionado = null;
        this.carregando = true;
        this.carregarPublicacao();

      },

      error: erro => {

        console.error('Erro ao enviar arquivo:', erro);

        this.enviandoArquivo = false;
        alert('Não foi possível enviar o arquivo. Use PDF ou TXT de até 20 MB.');
        this.changeDetectorRef.detectChanges();

      }

    });

  }

  // ===== botões da lateral e do topo =====

  voltar(): void {
    this.router.navigate(['/publicacao', this.id]);
  }

  irParaHome(): void {
    this.router.navigate(['/']);
  }

  voltarColecao(): void {

    if (this.idColecao) {
      this.router.navigate(['/colecao', this.idColecao]);
    }

  }

  alternarTelaCheia(): void {

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }

  }

  ngOnDestroy(): void {

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.pdfUrl = null;

    this.enviarProgresso();

  }

}