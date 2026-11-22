import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SessaoService } from '../../services/sessao.service';

type Aba = 'titulos' | 'recentes' | 'membros';

@Component({
  selector: 'app-grupo-detalhe',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grupo-detalhe.html',
  styleUrl: './grupo-detalhe.css'
})
export class GrupoDetalhe implements OnInit {

  id = 0;

  grupo: any = null;

  carregando = true;

  naoEncontrado = false;

  abaAtiva: Aba = 'titulos';

  processando = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    this.id = Number(this.route.snapshot.paramMap.get('id'));

    if (!this.id) {
      this.naoEncontrado = true;
      this.carregando = false;
      return;
    }

    this.carregar();

  }

  carregar(): void {

    const usuario = SessaoService.usuario();

    this.apiService.obterGrupo(this.id, usuario ? usuario.id : 0).subscribe({

      next: grupo => {
        this.grupo = grupo;
        this.carregando = false;
        this.changeDetectorRef.detectChanges();
      },

      error: erro => {
        console.error('Erro ao carregar grupo:', erro);
        this.naoEncontrado = true;
        this.carregando = false;
        this.changeDetectorRef.detectChanges();
      }

    });

  }

  get inicial(): string {
    return (this.grupo?.nome || '?').charAt(0).toUpperCase();
  }

  get textoMembros(): string {
    const total = this.grupo?.membros?.length ?? 0;
    return total + (total === 1 ? ' membro' : ' membros');
  }

  get textoTitulos(): string {
    const total = this.grupo?.titulos ?? 0;
    return total + (total === 1 ? ' título' : ' títulos');
  }

  alternarSeguir(): void {

    const usuario = SessaoService.usuario();

    if (!usuario || this.processando) {
      return;
    }

    this.processando = true;

    const chamada = this.grupo.seguindo
      ? this.apiService.deixarGrupo(this.id, usuario.id)
      : this.apiService.seguirGrupo(this.id, usuario.id);

    chamada.subscribe({

      next: () => {
        this.processando = false;
        this.carregar();
      },

      error: erro => {
        console.error('Erro ao seguir/deixar de seguir:', erro);
        this.processando = false;
        alert('Não foi possível concluir a ação.');
      }

    });

  }

  voltar(): void {
    this.router.navigate(['/grupos-seguidos']);
  }

}