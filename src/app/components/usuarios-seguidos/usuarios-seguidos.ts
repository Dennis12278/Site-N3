import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar';
import { ApiService } from '../../services/api.service';
import { SessaoService } from '../../services/sessao.service';

interface UsuarioSeguido {
  id: number;
  nome: string;
  avatar: string | null;
  publicacoes: number;
  dataSeguiu: string;
}

@Component({
  selector: 'app-usuarios-seguidos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent
  ],
  templateUrl: './usuarios-seguidos.html',
  styleUrl: './usuarios-seguidos.css'
})
export class UsuariosSeguidos implements OnInit {

  usuarios: UsuarioSeguido[] = [];

  carregando = false;

  pesquisa = '';

  ordenacao = 'recentes';

  constructor(
    private router: Router,
    private apiService: ApiService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {

    const usuario = SessaoService.usuario();

    if (!usuario) {
      return;
    }

    this.carregando = true;

    this.apiService.listarUsuariosSeguidos(usuario.id).subscribe({

      next: itens => {

        this.usuarios = itens.map(item => ({
          id: item.id,
          nome: item.nome,
          avatar: item.avatar ?? null,
          publicacoes: item.publicacoes,
          dataSeguiu: item.dataSeguiu
        }));

        this.carregando = false;
        this.changeDetectorRef.detectChanges();

      },

      error: erro => {

        console.error('Erro ao buscar usuários seguidos:', erro);

        this.carregando = false;
        this.changeDetectorRef.detectChanges();

      }

    });

  }

  get usuariosFiltrados(): UsuarioSeguido[] {

    let lista = [...this.usuarios];

    const texto = this.pesquisa.trim().toLowerCase();

    if (texto !== '') {
      lista = lista.filter(u => u.nome.toLowerCase().includes(texto));
    }

    if (this.ordenacao === 'nome') {
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    return lista;

  }

  inicial(nome: string): string {
    return (nome || '?').charAt(0).toUpperCase();
  }

  urlAvatar(avatar: string | null): string {
    return avatar ?? '';
  }

  abrirPerfil(usuario: UsuarioSeguido): void {
    // por enquanto, abre o perfil público do próprio usuário logado;
    // o perfil de outros usuários será ligado em uma próxima etapa
    this.router.navigate(['/perfil-publico']);
  }

  deixarDeSeguir(usuario: UsuarioSeguido): void {

    const sessao = SessaoService.usuario();

    if (!sessao) {
      return;
    }

    if (!confirm(`Deseja deixar de seguir ${usuario.nome}?`)) {
      return;
    }

    this.apiService.deixarDeSeguirUsuario(sessao.id, usuario.id).subscribe({

      next: () => {

        this.usuarios = this.usuarios.filter(item => item.id !== usuario.id);
        this.changeDetectorRef.detectChanges();

      },

      error: erro => {

        console.error('Erro ao deixar de seguir:', erro);
        alert('Não foi possível deixar de seguir este usuário.');

      }

    });

  }

}
