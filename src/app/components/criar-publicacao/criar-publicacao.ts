import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SessaoService } from '../../services/sessao.service';

@Component({
  selector: 'app-criar-publicacao',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './criar-publicacao.html',
  styleUrl: './criar-publicacao.css'
})
export class CriarPublicacao implements OnInit {

  titulo = '';
  descricao = '';
  visibilidade = 'publica';

  // arquivo de leitura (PDF ou TXT), enviado depois de salvar a publicação
  arquivoSelecionado: File | null = null;
  capaSelecionada: File | null = null;

  capaPreview = '';
  enviando = false;

  // usados só na edição
  idEdicao: number | null = null;
  capaAtual: string | null = null;
  removerCapa = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
  }

  get modoEdicao(): boolean {
    return this.idEdicao !== null;
  }

  ngOnInit(): void {

    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!id) {
      return;
    }

    this.idEdicao = id;

    this.apiService.obterDocumento(id).subscribe({
      next: documento => {
        this.titulo = documento.titulo;
        this.descricao = documento.conteudo ?? '';
        this.visibilidade = documento.visibilidade ?? 'publica';
        this.capaAtual = documento.capa ?? null;

        this.atualizarPreview();

        this.changeDetectorRef.detectChanges();
      },

      error: erro => {
        console.error('Erro ao buscar publicação:', erro);

        alert('Não foi possível carregar a publicação.');

        this.router.navigate(['/minhas-publicacoes']);
      }
    });
  }

  private atualizarPreview(): void {

    if (this.capaSelecionada) {
      this.capaPreview = URL.createObjectURL(this.capaSelecionada);

    } else if (this.capaAtual && !this.removerCapa) {
      this.capaPreview = this.apiService.urlCapa(this.capaAtual);

    } else {
      this.capaPreview = '';
    }
  }

  selecionarArquivo(event: Event): void {

    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const arquivo = input.files[0];
    const nome = arquivo.name.toLowerCase();

    if (!nome.endsWith('.pdf') && !nome.endsWith('.txt')) {
      alert('Escolha um arquivo PDF ou TXT.');
      input.value = '';
      this.arquivoSelecionado = null;
      return;
    }

    this.arquivoSelecionado = arquivo;
  }

  escolherCapa(event: Event): void {

    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.capaSelecionada = input.files[0];
      this.removerCapa = false;

      this.atualizarPreview();
    }
  }

  removerCapaEscolhida(): void {
    this.capaSelecionada = null;

    this.atualizarPreview();
  }

  removerCapaAtual(): void {
    this.removerCapa = true;

    this.atualizarPreview();
  }

  publicar(): void {

    if (this.enviando) {
      return;
    }

    if (this.titulo.trim() === '') {
      alert('Digite um título para a publicação.');
      return;
    }

    this.enviando = true;

    const formulario = new FormData();

    formulario.append('titulo', this.titulo.trim());
    formulario.append('conteudo', this.descricao);
    formulario.append('visibilidade', this.visibilidade);

    if (this.capaSelecionada) {
      formulario.append('capa', this.capaSelecionada);
    }

    if (this.idEdicao !== null) {
      formulario.append('removerCapa', String(this.removerCapa));

      this.atualizarDocumento(this.idEdicao, formulario);

      return;
    }

    formulario.append('idUsuario', String(SessaoService.idUsuario()));
    formulario.append('idTipoDocumento', '1');

    this.salvarDocumento(formulario);
  }

  salvarDocumento(documento: FormData): void {

    this.apiService.criarDocumento(documento).subscribe({

      next: (criado: any) => {

        if (this.arquivoSelecionado) {
          this.enviarArquivo(criado.id, 'Publicação criada com sucesso!');
          return;
        }

        alert('Publicação criada com sucesso!');
        this.router.navigate(['/minhas-publicacoes']);
      },

      error: erro => {
        console.error('Erro ao criar publicação:', erro);

        this.enviando = false;

        alert('Não foi possível criar a publicação.');

        this.changeDetectorRef.detectChanges();
      }
    });
  }

  atualizarDocumento(id: number, documento: FormData): void {

    this.apiService.editarDocumento(id, documento).subscribe({

      next: () => {

        if (this.arquivoSelecionado) {
          this.enviarArquivo(id, 'Publicação atualizada com sucesso!');
          return;
        }

        alert('Publicação atualizada com sucesso!');
        this.router.navigate(['/minhas-publicacoes']);
      },

      error: erro => {
        console.error('Erro ao atualizar publicação:', erro);

        this.enviando = false;

        alert('Não foi possível atualizar a publicação.');

        this.changeDetectorRef.detectChanges();
      }
    });
  }

  
  private enviarArquivo(idDocumento: number, mensagemSucesso: string): void {

    const usuario = SessaoService.usuario();

    if (!usuario || !this.arquivoSelecionado) {
      alert(mensagemSucesso);
      this.router.navigate(['/minhas-publicacoes']);
      return;
    }

    this.apiService.enviarArquivoLeitura(idDocumento, usuario.id, this.arquivoSelecionado).subscribe({

      next: () => {
        alert(mensagemSucesso);
        this.router.navigate(['/minhas-publicacoes']);
      },

      error: erro => {

        console.error('Erro ao enviar arquivo de leitura:', erro);

        
        this.enviando = false;

        alert(mensagemSucesso + ' Mas o arquivo não foi enviado. Envie-o pela página de leitura.');

        this.router.navigate(['/minhas-publicacoes']);
      }
    });
  }

  voltar(): void {
    this.router.navigate(['/minhas-publicacoes']);
  }
}