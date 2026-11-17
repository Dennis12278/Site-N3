import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessaoService } from '../services/sessao.service';

const API_URL = 'http://localhost:5031';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const router = inject(Router);

  const token = SessaoService.token();

  const ehApi = req.url.startsWith(API_URL);
  const ehLogin = req.url.includes('/Auth/');

  
  const requisicao = token && ehApi
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(requisicao).pipe(
    catchError((erro: HttpErrorResponse) => {

     
      if (erro.status === 401 && ehApi && !ehLogin && token) {
        SessaoService.sair();
        router.navigate(['/login']);
      }

      return throwError(() => erro);
    })
  );
};