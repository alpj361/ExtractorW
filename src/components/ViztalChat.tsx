'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TextShimmer } from './ui/text-shimmer';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

// ------------------------------------------------------------
// Utilidad local para resolver la URL base del backend ExtractorW
// Se inspira en la misma lógica usada en PulseJ/src/services/api.ts
// ------------------------------------------------------------

function resolveExtractorWUrl(): string {
  // 1) Si existe variable de entorno explícita (por ejemplo en Netlify / Vercel)
  if (process.env.NEXT_PUBLIC_EXTRACTORW_API_URL) {
    return process.env.NEXT_PUBLIC_EXTRACTORW_API_URL.replace(/\/$/, ''); // sin barra final
  }

  // 2) Detectar entorno de desarrollo automáticamente (host localhost *o* NODE_ENV === 'development')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(host);
    if (isLocalHost || process.env.NODE_ENV === 'development') {
      return 'http://localhost:8080/api';
    }
  }

  // 3) Fallback a producción (link real)
  return 'https://server.standatpd.com/api';
}

// Nota: No llamamos a resolveExtractorWUrl en SSR para evitar evaluar window.

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolUsed?: string;
  executionTime?: number;
  tweetAnalyzed?: number;
}

interface ViztalChatProps {
  apiBaseUrl?: string;
  className?: string;
  placeholder?: string;
  userToken?: string;
}

export function ViztalChat({ 
  apiBaseUrl,
  className,
  placeholder = 'Pregúntame sobre tendencias, análisis de redes sociales o búsquedas web...',
  userToken
}: ViztalChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Generate session ID on mount
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Determinar base final: si prop viene completa (http) úsala, de lo contrario usa la interna
    const apiBase = (apiBaseUrl && apiBaseUrl.startsWith('http')) ? apiBaseUrl : resolveExtractorWUrl();
    console.log('🔧 ViztalChat: URL API base utilizada:', apiBase);

    try {
      const response = await fetch(`${apiBase}/vizta-chat/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userToken && { 'Authorization': `Bearer ${userToken}` })
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("🔍 Respuesta recibida del servidor:", JSON.stringify(data, null, 2));

      if (data.success) {
        let messageContent: string;

        // Lógica defensiva para asegurar que el contenido siempre sea un string
        if (data.response && typeof data.response.message === 'string') {
          messageContent = data.response.message;
        } else if (data.response && typeof data.response === 'string') {
          messageContent = data.response;
        } else {
          // Fallback: si no podemos encontrar el mensaje, mostramos el objeto de respuesta para depurar
          messageContent = `Respuesta con formato inesperado. Recibido:\n\n\`\`\`json\n${JSON.stringify(data.response || data, null, 2)}\n\`\`\``;
        }

        const assistantMessage: Message = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: messageContent,
          timestamp: new Date(data.response?.timestamp || Date.now()),
          toolUsed: data.toolUsed || data.response?.type,
          executionTime: data.executionTime || data.metadata?.processingTime,
          tweetAnalyzed: data.toolResult?.tweets?.length || data.responseMetadata?.tweetsAnalyzed
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Actualizar sessionId si no existe
        if (!sessionId && data.conversationId) {
          setSessionId(data.conversationId);
        }
      } else {
        throw new Error(data.message || 'Error en la respuesta del servidor');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `❌ **Error de conexión**\n\nNo pude procesar tu consulta. Verifica que:\n- El servidor esté funcionando\n- Tengas una conexión a internet estable\n- Los endpoints de la API estén disponibles\n\n*Error: ${error instanceof Error ? error.message : 'Error desconocido'}*`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatContent = (content: string) => {
    // Simple markdown-like formatting for better display
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/### (.*?)\n/g, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-200">$1</h3>')
      .replace(/## (.*?)\n/g, '<h2 class="text-xl font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-200">$1</h2>')
      .replace(/• (.*?)\n/g, '<li class="ml-4 mb-1">$1</li>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className={cn("flex flex-col h-full max-w-4xl mx-auto", className)}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Vizta Chat
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Asistente de investigación inteligente para Guatemala
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              🟢 Conectado
            </Badge>
            {sessionId && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {sessionId.split('_')[2]}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                ¡Hola! Soy Vizta
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Tu asistente especializado en análisis de redes sociales, búsquedas web y tendencias en Guatemala. 
                ¿En qué puedo ayudarte hoy?
              </p>
            </motion.div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "flex",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <Card className={cn(
                  "max-w-[80%] p-4",
                  message.role === 'user' 
                    ? "bg-blue-500 text-white ml-12" 
                    : "bg-white dark:bg-gray-800 mr-12"
                )}>
                  <div 
                    className={cn(
                      "prose prose-sm max-w-none",
                      message.role === 'user' 
                        ? "prose-invert" 
                        : "prose-gray dark:prose-invert"
                    )}
                    dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                  />
                  
                  {/* Message metadata */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-opacity-20">
                    <div className="flex items-center space-x-2 text-xs opacity-70">
                      <span>
                        {message.timestamp.toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      {message.toolUsed && (
                        <Badge variant="outline" className="text-xs py-0 px-1">
                          {message.toolUsed}
                        </Badge>
                      )}
                    </div>
                    
                    {message.role === 'assistant' && (
                      <div className="flex items-center space-x-1 text-xs opacity-70">
                        {message.executionTime && (
                          <span>{(message.executionTime / 1000).toFixed(1)}s</span>
                        )}
                        {message.tweetAnalyzed && (
                          <span>• {message.tweetAnalyzed} tweets</span>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <Card className="max-w-[80%] p-4 bg-white dark:bg-gray-800 mr-12">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center">
                    <span className="text-white text-sm">🤖</span>
                  </div>
                </div>
                <div className="flex-1">
                  <TextShimmer 
                    className="text-sm text-gray-600 dark:text-gray-400" 
                    duration={1.5}
                    spread={1}
                  >
                    Analizando tu consulta...
                  </TextShimmer>
                  <div className="mt-2">
                    <TextShimmer 
                      className="text-xs text-gray-500 dark:text-gray-500" 
                      duration={2}
                      spread={2}
                    >
                      Procesando datos y generando respuesta inteligente
                    </TextShimmer>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t bg-gray-50 dark:bg-gray-900">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     placeholder-gray-500 dark:placeholder-gray-400"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white 
                     rounded-lg font-medium hover:from-blue-600 hover:to-purple-600
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                <span>Enviando...</span>
              </div>
            ) : (
              '📤 Enviar'
            )}
          </motion.button>
        </div>
        
        {/* Quick suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "¿Qué está pasando en Guatemala hoy?",
            "Analiza el sentimiento sobre las elecciones",  
            "Busca tendencias en redes sociales",
            "¿Qué opinan sobre el nuevo gobierno?"
          ].map((suggestion) => (
            <motion.button
              key={suggestion}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setInput(suggestion);
                inputRef.current?.focus();
              }}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                       rounded-full hover:bg-gray-300 dark:hover:bg-gray-600
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-200"
            >
              {suggestion}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}