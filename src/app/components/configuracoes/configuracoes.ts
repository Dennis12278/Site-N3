import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
import { ApiService } from '../../services/api.service';
import { SessaoService } from '../../services/sessao.service';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent
  ],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.css'
})
export class Configuracoes implements OnInit {

  abaAtiva: string = 'conta';

  usuarioInicial: string = 'D';

  // dados da conta (vêm do servidor)
  nomeAtual: string = '';
  emailOriginal: string = '';
  email: string = '';

  // senha
  senhaAtual: string = '';
  novaSenha: string = '';
  confirmarSenha: string = '';

  // visibilidade (vem do servidor)
  perfilPublico: boolean = true;
  mostrarPublicacoes: boolean = true;
  mostrarEstatisticas: boolean = true;

  // tema (fica salvo neste navegador)
  tema: string = 'escuro';

  constructor(
    private apiService: ApiService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.tema = localStorage.getItem('dream_tema') ?? 'escuro';
  }

  carregar(): void {

    const usuario = SessaoService.usuario();

    if (!usuario) {
      return;
    }

    this.apiService.obterMeuPerfil(usuario.id).subscribe({

      next: perfil => {

        this.nomeAtual = perfil.nome;
        this.emailOriginal = perfil.email;
        this.email = perfil.email;

        this.usuarioInicial = (perfil.nome || 'D').charAt(0).toUpperCase();

        this.changeDetectorRef.detectChanges();

      },

      error: erro => console.error('Erro ao carregar conta:', erro)

    });

    this.apiService.obterPreferencias(usuario.id).subscribe({

      next: prefs => {

        this.perfilPublico = prefs.perfilPublico;
        this.mostrarPublicacoes = prefs.mostrarPublicacoes;
        this.mostrarEstatisticas = prefs.mostrarEstatisticas;

        this.changeDetectorRef.detectChanges();

      },

      error: erro => console.error('Erro ao carregar preferências:', erro)

    });

  }


  // ==============================
  // SALVAR CONTA (e-mail e/ou senha)
  // ==============================

  salvarConta(): void {

    const usuario = SessaoService.usuario();

    if (!usuario) {
      return;
    }

    const mudouEmail = this.email.trim() !== this.emailOriginal;
    const querTrocarSenha = this.novaSenha !== '' || this.confirmarSenha !== '';

    if (!mudouEmail && !querTrocarSenha) {
      alert('Nada para salvar.');
      return;
    }

    if (mudouEmail && !this.email.includes('@')) {
      alert('Informe um e-mail válido.');
      return;
    }

    if (querTrocarSenha) {

      if (this.novaSenha !== this.confirmarSenha) {
        alert('As senhas não são iguais.');
        return;
      }

      if (this.novaSenha.length < 6) {
        alert('A senha deve possuir pelo menos 6 caracteres.');
        return;
      }

      if (this.senhaAtual === '') {
        alert('Informe a senha atual para trocar a senha.');
        return;
      }
    }

    if (mudouEmail) {

      this.apiService.salvarPerfil(usuario.id, {
        nome: this.nomeAtual,
        email: this.email.trim(),
        biografia: '',
        links: ''
      }).subscribe({

        next: () => {

          this.emailOriginal = this.email.trim();

          SessaoService.entrar({
            id: usuario.id,
            nome: this.nomeAtual,
            email: this.email.trim(),
            token: usuario.token
          });

          this.changeDetectorRef.detectChanges();

        },

        error: erro => {
          console.error('Erro ao trocar e-mail:', erro);
          alert('Não foi possível trocar o e-mail.');
        }

      });
    }

    if (querTrocarSenha) {

      this.apiService.trocarSenha(usuario.id, {
        senhaAtual: this.senhaAtual,
        novaSenha: this.novaSenha
      }).subscribe({

        next: () => {

          this.senhaAtual = '';
          this.novaSenha = '';
          this.confirmarSenha = '';

          alert('Senha alterada com sucesso!');
          this.changeDetectorRef.detectChanges();

        },

        error: erro => {

          console.error('Erro ao trocar senha:', erro);

          alert(erro?.error === 'A senha atual está incorreta.'
            ? 'A senha atual está incorreta.'
            : 'Não foi possível trocar a senha.');

        }

      });
    }

    if (mudouEmail && !querTrocarSenha) {
      alert('E-mail atualizado com sucesso!');
    }

  }


  // ==============================
  // SALVAR VISIBILIDADE
  // ==============================

  salvarVisibilidade(): void {

    const usuario = SessaoService.usuario();

    if (!usuario) {
      return;
    }

    this.apiService.salvarPreferencias(usuario.id, {
      perfilPublico: this.perfilPublico,
      mostrarPublicacoes: this.mostrarPublicacoes,
      mostrarEstatisticas: this.mostrarEstatisticas
    }).subscribe({

      next: () => alert('Preferências de visibilidade salvas com sucesso!'),

      error: erro => {
        console.error('Erro ao salvar visibilidade:', erro);
        alert('Não foi possível salvar as preferências.');
      }

    });

  }


  // ==============================
  // SALVAR TEMA (neste navegador)
  // ==============================

  salvarTema(): void {

    localStorage.setItem('dream_tema', this.tema);

    alert('Preferência de tema salva neste navegador.');

  }

}