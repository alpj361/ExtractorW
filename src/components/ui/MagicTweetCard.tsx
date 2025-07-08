import React, { useCallback, useEffect, useState } from "react"
import { motion, useMotionTemplate, useMotionValue } from "framer-motion"
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Repeat,
  ChatBubbleOutline,
  Share,
  Verified
} from '@mui/icons-material';
import { TrendingTweet } from '../../types'

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}

export function MagicCard(props: any) {
  const {
    children,
    className,
    gradientSize = 200,
    gradientColor = "#262626",
    gradientOpacity = 0.8,
  } = props;

  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)

  const handleMouseMove = useCallback(
    (e: any) => {
      const { left, top } = e.currentTarget.getBoundingClientRect()
      mouseX.set(e.clientX - left)
      mouseY.set(e.clientY - top)
    },
    [mouseX, mouseY],
  )

  const handleMouseLeave = useCallback(() => {
    mouseX.set(-gradientSize)
    mouseY.set(-gradientSize)
  }, [mouseX, mouseY, gradientSize])

  useEffect(() => {
    mouseX.set(-gradientSize)
    mouseY.set(-gradientSize)
  }, [mouseX, mouseY, gradientSize])

  return (
    <Box
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        '&:hover .magic-overlay': {
          opacity: gradientOpacity,
        }
      }}
      className={className}
    >
      <Box sx={{ position: 'relative', zIndex: 10, width: '100%' }}>
        {children}
      </Box>
      <motion.div
        className="magic-overlay"
        style={{
          position: 'absolute',
          top: -1,
          left: -1,
          right: -1,
          bottom: -1,
          borderRadius: 12,
          opacity: 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
          background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)
          `,
        }}
      />
    </Box>
  )
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Fecha no disponible';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const getCategoryColor = (categoria: string) => {
  switch (categoria) {
    case 'Política':
      return "#9c27b0";
    case 'Económica':
      return "#4caf50";
    case 'Sociales':
      return "#2196f3";
    default:
      return "#9e9e9e";
  }
};

const getEmotionEmoji = (sentimiento: string) => {
  switch (sentimiento) {
    case 'positivo':
      return '😊';
    case 'negativo':
      return '😔';
    default:
      return '😐';
  }
};

const getIntentionIcon = (intencion: string) => {
  switch (intencion) {
    case 'informativo':
      return '📊';
    case 'opinativo':
      return '💭';
    case 'humoristico':
      return '😄';
    case 'alarmista':
      return '⚠️';
    case 'critico':
      return '🔍';
    case 'promocional':
      return '📢';
    case 'conversacional':
      return '💬';
    case 'protesta':
      return '✊';
    default:
      return '📝';
  }
};

export function MagicTweetCard(props: any) {
  const { 
    tweet, 
    layout = 'expanded',
    onLike,
    onRetweet,
    onShare
  } = props;

  const [isLiked, setIsLiked] = useState(false);
  const [isRetweeted, setIsRetweeted] = useState(false);
  const [localLikes, setLocalLikes] = useState(tweet.likes);
  const [localRetweets, setLocalRetweets] = useState(tweet.retweets);

  const categoryColor = getCategoryColor(tweet.categoria);

  const handleLike = (e: any) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLocalLikes((prev: number) => isLiked ? prev - 1 : prev + 1);
    onLike?.(tweet.tweet_id);
  };

  const handleRetweet = (e: any) => {
    e.stopPropagation();
    setIsRetweeted(!isRetweeted);
    setLocalRetweets((prev: number) => isRetweeted ? prev - 1 : prev + 1);
    onRetweet?.(tweet.tweet_id);
  };

  const handleShare = (e: any) => {
    e.stopPropagation();
    onShare?.(tweet.tweet_id);
  };

  // Extract username from the usuario field (format: "Name @username")
  const extractUsername = (usuario: string) => {
    const match = usuario.match(/@([^\s]+)/);
    return match ? `@${match[1]}` : '@usuario';
  };

  const extractName = (usuario: string) => {
    const parts = usuario.split('@');
    return parts[0].trim() || 'Usuario';
  };

  return (
    <MagicCard gradientColor={categoryColor}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Avatar placeholder */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            {extractName(tweet.usuario).charAt(0).toUpperCase()}
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {extractName(tweet.usuario)}
              </Typography>
              {tweet.verified && (
                <Verified sx={{ fontSize: 16, color: '#1976d2' }} />
              )}
              <Typography variant="body2" color="text.secondary">
                {extractUsername(tweet.usuario)}
              </Typography>
              <Typography variant="body2" color="text.secondary">·</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDate(tweet.fecha_tweet || (tweet as any).fecha)}
              </Typography>
            </Box>
            
            {/* Category and Emotion Badges */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip 
                label={tweet.categoria}
                size="small"
                sx={{ 
                  bgcolor: categoryColor + '20',
                  color: categoryColor,
                  border: `1px solid ${categoryColor}`,
                  fontSize: '0.75rem'
                }}
              />
              
              <Chip 
                label={`${getEmotionEmoji(tweet.sentimiento)} ${tweet.sentimiento}`}
                size="small"
                sx={{ 
                  bgcolor: tweet.sentimiento === 'positivo' 
                    ? '#4caf5020' 
                    : tweet.sentimiento === 'negativo' 
                    ? '#f4433620' 
                    : '#9e9e9e20',
                  color: tweet.sentimiento === 'positivo' 
                    ? '#4caf50' 
                    : tweet.sentimiento === 'negativo' 
                    ? '#f44336' 
                    : '#9e9e9e',
                  fontSize: '0.75rem'
                }}
              />
              
              {tweet.intencion_comunicativa && (
                <Chip 
                  label={`${getIntentionIcon(tweet.intencion_comunicativa)} ${tweet.intencion_comunicativa}`}
                  size="small"
                  sx={{ 
                    bgcolor: '#2196f320',
                    color: '#2196f3',
                    fontSize: '0.75rem'
                  }}
                />
              )}
            </Box>
            
            {/* Tweet Content */}
            <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.5 }}>
              {layout === 'compact' 
                ? tweet.texto.substring(0, 140) + (tweet.texto.length > 140 ? '...' : '')
                : tweet.texto}
            </Typography>
            
            {/* Engagement Stats */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Tooltip title="Respuestas">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', cursor: 'pointer' }}>
                    <ChatBubbleOutline sx={{ fontSize: 16 }} />
                    <Typography variant="caption">{formatNumber(tweet.replies)}</Typography>
                  </Box>
                </Tooltip>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Tooltip title="Retweets">
                  <Box 
                    onClick={handleRetweet}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      color: isRetweeted ? '#4caf50' : 'text.secondary',
                      cursor: 'pointer'
                    }}
                  >
                    <Repeat sx={{ fontSize: 16 }} />
                    <Typography variant="caption">{formatNumber(localRetweets)}</Typography>
                  </Box>
                </Tooltip>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Tooltip title="Me gusta">
                  <Box 
                    onClick={handleLike}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      color: isLiked ? '#f44336' : 'text.secondary',
                      cursor: 'pointer'
                    }}
                  >
                    {isLiked ? <Favorite sx={{ fontSize: 16 }} /> : <FavoriteBorder sx={{ fontSize: 16 }} />}
                    <Typography variant="caption">{formatNumber(localLikes)}</Typography>
                  </Box>
                </Tooltip>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Tooltip title="Compartir">
                  <Box 
                    onClick={handleShare}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      color: 'text.secondary',
                      cursor: 'pointer'
                    }}
                  >
                    <Share sx={{ fontSize: 16 }} />
                  </Box>
                </Tooltip>
              </motion.div>
            </Box>

            {/* Additional metadata for full layout */}
            {layout === 'full' && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {tweet.score_sentimiento && (
                    <Typography variant="caption" color="text.secondary">
                      Sentimiento: {(tweet.score_sentimiento * 100).toFixed(1)}%
                    </Typography>
                  )}
                  {tweet.propagacion_viral && (
                    <Typography variant="caption" color="text.secondary">
                      Propagación: {tweet.propagacion_viral}
                    </Typography>
                  )}
                  {tweet.location && (
                    <Typography variant="caption" color="text.secondary">
                      Ubicación: {tweet.location}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </MagicCard>
  );
}

export default MagicTweetCard; 