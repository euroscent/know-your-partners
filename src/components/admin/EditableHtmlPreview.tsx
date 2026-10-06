import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eraser, MousePointer, Code, ImageOff, Sparkles, Loader2, ImagePlus, Replace } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EditableHtmlPreviewProps {
  content: string;
  onChange: (content: string) => void;
  taskTitle?: string;
}

export function EditableHtmlPreview({ content, onChange, taskTitle }: EditableHtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragOverPreview, setIsDragOverPreview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    src: string;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    element?: HTMLImageElement;
  } | null>(null);
  const [imageScale, setImageScale] = useState(100);

  // Upload image to storage and return signed URL (since kyc-uploads is private)
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Nur Bilddateien erlaubt");
        return null;
      }

      // Max 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Bild darf max. 5MB groß sein");
        return null;
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `email-images/${timestamp}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-uploads')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Fehler beim Hochladen");
        return null;
      }

      // Get signed URL (valid for 1 year) since bucket is private
      const { data: urlData, error: urlError } = await supabase.storage
        .from('kyc-uploads')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (urlError || !urlData?.signedUrl) {
        console.error("Signed URL error:", urlError);
        toast.error("Fehler beim Generieren der Bild-URL");
        return null;
      }

      return urlData.signedUrl;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Fehler beim Hochladen");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Insert image tag at cursor or end
  const insertImageTag = (url: string) => {
    // Insert image with inline styles for easy positioning
    const imgTag = `<img src="${url}" alt="Bild" style="max-width: 100%; height: auto; display: block; margin: 16px auto;" />`;
    
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + "\n" + imgTag + "\n" + content.substring(end);
      onChange(newContent);
      
      // Set cursor after inserted tag
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + imgTag.length + 2;
        textarea.focus();
      }, 0);
    } else {
      // Append at end if no cursor position
      onChange(content + "\n" + imgTag);
    }
    
    toast.success("Bild eingefügt!");
  };

  // Handle file drop on textarea
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));

    if (imageFile) {
      const url = await uploadImage(imageFile);
      if (url) {
        insertImageTag(url);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  // Handle file drop on preview - upload and inject at drop position
  const handlePreviewDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverPreview(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));

    if (!imageFile) return;

    const url = await uploadImage(imageFile);
    if (!url) return;

    // Create new img tag
    const imgTag = `<img src="${url}" alt="Bild" style="max-width: 100%; height: auto; display: block; margin: 16px auto;" />`;

    // Try to inject at the drop position in the iframe
    const iframe = iframeRef.current;
    if (iframe?.contentDocument) {
      const doc = iframe.contentDocument;
      
      // Find element at drop position
      const dropX = e.clientX - iframe.getBoundingClientRect().left;
      const dropY = e.clientY - iframe.getBoundingClientRect().top;
      const elementAtPoint = doc.elementFromPoint(dropX, dropY);
      
      if (elementAtPoint) {
        // Create a temp image element and insert it
        const tempImg = doc.createElement('img');
        tempImg.src = url;
        tempImg.alt = 'Bild';
        tempImg.style.cssText = 'max-width: 100%; height: auto; display: block; margin: 16px auto;';
        
        // Find best insertion point (after the element or inside if it's a container)
        const isContainer = ['DIV', 'TD', 'TH', 'SECTION', 'ARTICLE', 'MAIN', 'BODY', 'TABLE'].includes(elementAtPoint.tagName);
        
        if (isContainer && elementAtPoint.tagName !== 'TABLE') {
          elementAtPoint.appendChild(tempImg);
        } else if (elementAtPoint.parentElement) {
          elementAtPoint.parentElement.insertBefore(tempImg, elementAtPoint.nextSibling);
        } else {
          doc.body.appendChild(tempImg);
        }
        
        // Get updated HTML and clean it up
        let newHtml = doc.documentElement.outerHTML;
        // Remove any injected edit scripts/styles from edit mode
        newHtml = newHtml.replace(/<style>[\s\S]*?\[data-editable][\s\S]*?<\/style>/g, '');
        newHtml = newHtml.replace(/<script>[\s\S]*?data-editable[\s\S]*?<\/script>/g, '');
        newHtml = newHtml.replace(/\s*data-editable="true"/g, '');
        newHtml = newHtml.replace(/\s*contenteditable="(true|false)"/g, '');
        
        onChange(newHtml);
        toast.success("Bild in Vorschau eingefügt!");
        return;
      }
    }
    
    // Fallback: append at end if injection failed
    onChange(content + "\n" + imgTag);
    toast.success("Bild am Ende eingefügt");
  };

  const handlePreviewDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverPreview(true);
  };

  const handlePreviewDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverPreview(false);
  };

  // Handle file input change
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await uploadImage(file);
      if (url) {
        insertImageTag(url);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Inject edit mode script into iframe
  const getEditableContent = useCallback(() => {
    // Always inject drag capabilities for images
    const dragScript = `
      <style>
        img[data-draggable] {
          cursor: grab !important;
          transition: outline 0.15s, transform 0.15s;
        }
        img[data-draggable]:hover {
          outline: 3px dashed #3b82f6 !important;
          outline-offset: 4px;
        }
        img[data-draggable].dragging {
          opacity: 0.5;
          cursor: grabbing !important;
        }
        img[data-draggable].selected {
          outline: 3px solid #22c55e !important;
          outline-offset: 4px;
        }
        .drop-indicator {
          height: 4px;
          background: #22c55e;
          margin: 8px 0;
          border-radius: 2px;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        ${isEditMode ? `
          [data-editable]:hover {
            outline: 2px dashed #3b82f6 !important;
            cursor: text !important;
          }
          [data-editable]:focus {
            outline: 2px solid #3b82f6 !important;
            background: rgba(59, 130, 246, 0.1) !important;
          }
          [contenteditable="true"] {
            outline: 2px solid #22c55e !important;
            background: rgba(34, 197, 94, 0.1) !important;
          }
        ` : ''}
      </style>
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          var draggedImg = null;
          var dropIndicator = null;
          
          // Make all images draggable
          function setupImages() {
            var images = document.querySelectorAll('img');
            images.forEach(function(img) {
              img.setAttribute('data-draggable', 'true');
              img.setAttribute('draggable', 'true');
              
              img.addEventListener('dragstart', function(e) {
                draggedImg = this;
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
              });
              
              img.addEventListener('dragend', function(e) {
                this.classList.remove('dragging');
                if (dropIndicator && dropIndicator.parentNode) {
                  dropIndicator.parentNode.removeChild(dropIndicator);
                }
                dropIndicator = null;
                draggedImg = null;
                
                // Send updated HTML to parent
                window.parent.postMessage({
                  type: 'html-updated',
                  html: document.documentElement.outerHTML
                }, '*');
              });
              
              // Click to select for resizing/replacing
              img.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Remove selection from other images
                document.querySelectorAll('img.selected').forEach(function(i) {
                  i.classList.remove('selected');
                });
                
                this.classList.add('selected');
                
                // Get computed dimensions or natural dimensions
                var currentWidth = this.style.width ? parseInt(this.style.width) : (this.width || this.naturalWidth);
                var currentHeight = this.style.height ? parseInt(this.style.height) : (this.height || this.naturalHeight);
                var originalWidth = this.naturalWidth || this.width || 300;
                var originalHeight = this.naturalHeight || this.height || 200;
                
                // Send selection to parent with full dimension info
                window.parent.postMessage({
                  type: 'image-selected',
                  src: this.src,
                  width: currentWidth,
                  height: currentHeight,
                  originalWidth: originalWidth,
                  originalHeight: originalHeight
                }, '*');
              });
            });
          }
          
          // Click elsewhere to deselect
          document.body.addEventListener('click', function(e) {
            if (e.target.tagName !== 'IMG') {
              document.querySelectorAll('img.selected').forEach(function(i) {
                i.classList.remove('selected');
              });
              window.parent.postMessage({ type: 'image-deselected' }, '*');
            }
          });
          
          // Handle drop zones
          document.body.addEventListener('dragover', function(e) {
            if (!draggedImg) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            var target = e.target;
            if (target === draggedImg) return;
            
            // Remove old indicator
            if (dropIndicator && dropIndicator.parentNode) {
              dropIndicator.parentNode.removeChild(dropIndicator);
            }
            
            // Create drop indicator
            dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator';
            
            // Find best insertion point
            if (target.tagName === 'IMG' && target !== draggedImg) {
              target.parentNode.insertBefore(dropIndicator, target);
            } else if (['DIV', 'TD', 'P', 'SECTION', 'ARTICLE'].includes(target.tagName)) {
              target.appendChild(dropIndicator);
            }
          });
          
          document.body.addEventListener('drop', function(e) {
            if (!draggedImg) return;
            e.preventDefault();
            
            var target = e.target;
            
            // Move the image
            if (dropIndicator && dropIndicator.parentNode) {
              dropIndicator.parentNode.insertBefore(draggedImg, dropIndicator);
              dropIndicator.parentNode.removeChild(dropIndicator);
            } else if (target.tagName === 'IMG' && target !== draggedImg) {
              target.parentNode.insertBefore(draggedImg, target);
            } else if (['DIV', 'TD', 'P', 'SECTION', 'ARTICLE', 'BODY'].includes(target.tagName)) {
              target.appendChild(draggedImg);
            }
            
            dropIndicator = null;
          });
          
          setupImages();
          
          // Re-setup when new images are added
          var observer = new MutationObserver(function(mutations) {
            setupImages();
          });
          observer.observe(document.body, { childList: true, subtree: true });
          
          ${isEditMode ? `
          // Text editing (only in edit mode)
          var textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, td, th, li, div, strong, em, b, i');
          textElements.forEach(function(el) {
            if (el.children.length === 0 || (el.textContent && el.textContent.trim().length > 0)) {
              el.setAttribute('data-editable', 'true');
              el.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.contentEditable = 'true';
                this.focus();
              });
              el.addEventListener('blur', function() {
                this.contentEditable = 'false';
                window.parent.postMessage({
                  type: 'html-updated',
                  html: document.documentElement.outerHTML
                }, '*');
              });
            }
          });
          ` : ''}
        });
      </script>
    `;
    
    // Insert script before </body> or at end
    if (content.includes('</body>')) {
      return content.replace('</body>', dragScript + '</body>');
    } else if (content.includes('</html>')) {
      return content.replace('</html>', dragScript + '</html>');
    }
    return content + dragScript;
  }, [content, isEditMode]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'html-updated' && event.data?.html) {
        // Robustly parse and clean up the iframe HTML before syncing back.
        // Regex-based stripping can accidentally remove large chunks of HTML.
        const parser = new DOMParser();
        const iframeDoc = parser.parseFromString(event.data.html, 'text/html');

        // Remove injected helper style/script blocks (drag + edit mode)
        iframeDoc.querySelectorAll('style, script').forEach((node) => {
          const text = node.textContent || '';
          if (text.includes('data-draggable') || text.includes('data-editable') || text.includes('drop-indicator')) {
            node.remove();
          }
        });

        // Remove editor attributes/classes from all elements
        iframeDoc.querySelectorAll('[data-draggable], [data-editable], [draggable], [contenteditable], .dragging, .selected, .drop-indicator').forEach((el) => {
          el.removeAttribute('data-draggable');
          el.removeAttribute('data-editable');
          el.removeAttribute('draggable');
          el.removeAttribute('contenteditable');
          el.classList.remove('dragging');
          el.classList.remove('selected');
          if (el.classList.contains('drop-indicator')) el.remove();
        });

        // Sync back in the SAME structural form as the original input.
        // - If the user originally edited a full HTML document, keep a full document.
        // - If the original was a fragment, only persist body.innerHTML.
        const originalWasFullDocument = /<!doctype\b/i.test(content) || /<html\b/i.test(content);
        if (originalWasFullDocument) {
          let next = (iframeDoc.documentElement?.outerHTML || '').trim();
          // DOMParser drops the doctype; re-add it if the original contained one.
          if (/<!doctype\b/i.test(content) && !/^<!doctype\b/i.test(next)) {
            next = `<!doctype html>${next}`;
          }
          onChange(next);
        } else {
          const bodyHtml = (iframeDoc.body?.innerHTML || '').trim();
          onChange(bodyHtml);
        }
      } else if (event.data?.type === 'image-selected') {
        setSelectedImage({
          src: event.data.src,
          width: event.data.width,
          height: event.data.height || event.data.width,
          originalWidth: event.data.originalWidth,
          originalHeight: event.data.originalHeight || event.data.originalWidth
        });
        // Calculate initial scale
        const scale = Math.round((event.data.width / event.data.originalWidth) * 100);
        setImageScale(Math.min(200, Math.max(10, scale || 100)));
      } else if (event.data?.type === 'image-deselected') {
        setSelectedImage(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onChange, content]);

  // Apply image resize
  const handleImageResize = useCallback((newScale: number[]) => {
    const scale = newScale[0];
    setImageScale(scale);
    
    if (!selectedImage || !iframeRef.current?.contentDocument) return;
    
    const doc = iframeRef.current.contentDocument;
    const selectedImg = doc.querySelector('img.selected') as HTMLImageElement;
    
    if (selectedImg) {
      const newWidth = Math.round((selectedImage.originalWidth * scale) / 100);
      selectedImg.style.width = `${newWidth}px`;
      selectedImg.style.height = 'auto';
    }
  }, [selectedImage]);

  // DOM-based cleanup helper: removes injected editor scripts/styles/attributes
  // and syncs back in the same format as the original content (full doc vs fragment)
  const cleanAndSyncHtml = useCallback((doc: Document) => {
    const parser = new DOMParser();
    const cleanDoc = parser.parseFromString(doc.documentElement.outerHTML, 'text/html');

    // Remove injected helper style/script blocks
    cleanDoc.querySelectorAll('style, script').forEach((node) => {
      const text = node.textContent || '';
      if (text.includes('data-draggable') || text.includes('data-editable') || text.includes('drop-indicator')) {
        node.remove();
      }
    });

    // Remove editor attributes/classes
    cleanDoc.querySelectorAll('[data-draggable], [data-editable], [draggable], [contenteditable], .dragging, .selected, .drop-indicator').forEach((el) => {
      el.removeAttribute('data-draggable');
      el.removeAttribute('data-editable');
      el.removeAttribute('draggable');
      el.removeAttribute('contenteditable');
      el.classList.remove('dragging');
      el.classList.remove('selected');
      if (el.classList.contains('drop-indicator')) el.remove();
    });

    // Remove injected <base> tags from preview wrapper
    cleanDoc.querySelectorAll('base').forEach((el) => el.remove());

    const originalWasFullDocument = /<!doctype\b/i.test(content) || /<html\b/i.test(content);
    if (originalWasFullDocument) {
      let result = (cleanDoc.documentElement?.outerHTML || '').trim();
      if (/<!doctype\b/i.test(content) && !/^<!doctype\b/i.test(result)) {
        result = `<!doctype html>${result}`;
      }
      return result;
    } else {
      return (cleanDoc.body?.innerHTML || '').trim();
    }
  }, [content]);

  // Apply final resize and sync to content
  const applyImageResize = useCallback(() => {
    if (!iframeRef.current?.contentDocument) return;
    
    const cleanHtml = cleanAndSyncHtml(iframeRef.current.contentDocument);
    onChange(cleanHtml);
    setSelectedImage(null);
    toast.success("Bildgröße angepasst");
  }, [onChange, cleanAndSyncHtml]);

  // Replace selected image with new image, keeping exact dimensions
  const handleReplaceImage = async (file: File) => {
    if (!selectedImage || !iframeRef.current?.contentDocument) {
      toast.error("Bitte zuerst ein Bild in der Vorschau auswählen");
      return;
    }

    setIsReplacing(true);
    try {
      // Upload new image
      const newUrl = await uploadImage(file);
      if (!newUrl) {
        setIsReplacing(false);
        return;
      }

      const doc = iframeRef.current.contentDocument;
      const selectedImg = doc.querySelector('img.selected') as HTMLImageElement;
      
      if (!selectedImg) {
        toast.error("Ausgewähltes Bild nicht gefunden");
        setIsReplacing(false);
        return;
      }

      // Store exact current dimensions before replacement
      const currentWidth = selectedImg.style.width || `${selectedImg.width || selectedImage.width}px`;
      const currentHeight = selectedImg.style.height || (selectedImg.height ? `${selectedImg.height}px` : 'auto');
      
      // Replace the image source while keeping exact same dimensions
      selectedImg.src = newUrl;
      selectedImg.style.width = currentWidth;
      selectedImg.style.height = currentHeight;
      selectedImg.style.objectFit = 'cover'; // Ensure new image fills the space properly
      
      // Sync back to HTML content using DOM-based cleanup
      const cleanHtml = cleanAndSyncHtml(doc);
      onChange(cleanHtml);
      setSelectedImage(null);
      toast.success("Bild ersetzt – Größe beibehalten!");
    } catch (err) {
      console.error("Error replacing image:", err);
      toast.error("Fehler beim Ersetzen des Bildes");
    } finally {
      setIsReplacing(false);
    }
  };

  // Handle replace file input change
  const handleReplaceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleReplaceImage(file);
    }
    // Reset input
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
    }
  };

  // Strip middle content but keep header and footer
  const handleStripText = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // Detect original format to persist the same structure
    const originalWasFullDocument = /<!doctype\b/i.test(content) || /<html\b/i.test(content);

    // Helper: Recursively clear all text content within an element
    const clearTextInElement = (element: Element) => {
      // Get all text nodes within the element
      const getTextNodes = (el: Element): Text[] => {
        const nodes: Text[] = [];
        const walk = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            nodes.push(node as Text);
          } else {
            node.childNodes.forEach(walk);
          }
        };
        walk(el);
        return nodes;
      };

      const textNodes = getTextNodes(element);
      textNodes.forEach((textNode) => {
        const trimmed = textNode.textContent?.trim();
        // Only clear if it has meaningful text (not just whitespace)
        if (trimmed && trimmed.length > 0) {
          textNode.textContent = '';
        }
      });
    };

    // Email templates often have deeply nested tables.
    // Strategy: Find ALL <tr> elements, then determine header/footer zones
    // based on position relative to all rows in the document.
    const allRows = Array.from(doc.querySelectorAll('tr'));
    
    console.log('[StripText] Found', allRows.length, 'rows total');

    if (allRows.length === 0) {
      // Fallback for non-table layouts - find all content blocks
      const allBlocks = Array.from(doc.body.querySelectorAll('div, section, article, p, h1, h2, h3'));
      console.log('[StripText] No tables, found', allBlocks.length, 'blocks');
      
      if (allBlocks.length < 3) {
        toast.error("Kein geeignetes Layout erkannt (zu wenige Elemente)");
        return;
      }
      
      // Keep first 20% and last 20% of blocks
      const headerCount = Math.max(1, Math.floor(allBlocks.length * 0.2));
      const footerStart = allBlocks.length - Math.max(1, Math.floor(allBlocks.length * 0.2));
      
      allBlocks.forEach((block, idx) => {
        if (idx >= headerCount && idx < footerStart) {
          clearTextInElement(block);
        }
      });
      
      // Sync back in the same format as original input
      if (originalWasFullDocument) {
        let result = doc.documentElement.outerHTML;
        if (/<!doctype\b/i.test(content) && !/^<!doctype\b/i.test(result)) {
          result = `<!doctype html>${result}`;
        }
        onChange(result);
      } else {
        onChange(doc.body?.innerHTML || '');
      }
      toast.success("Mittlerer Inhalt entfernt, Header & Footer beibehalten");
      return;
    }

    // Zone-based approach on ALL rows in the document:
    // Header zone = first 2 rows (minimum 1)
    // Footer zone = last 2 rows (minimum 1)
    // Everything in between = middle content -> clear text
    const totalRows = allRows.length;
    
    // Ensure at least 1 row for header and 1 for footer
    // For small templates (< 5 rows), keep first and last row only
    let headerZoneEnd: number;
    let footerZoneStart: number;
    
    if (totalRows <= 3) {
      // Too few rows - keep first and last, clear middle (if any)
      headerZoneEnd = 1;
      footerZoneStart = totalRows - 1;
    } else if (totalRows <= 6) {
      // Small template - keep first 1-2 and last 1-2
      headerZoneEnd = Math.min(2, Math.ceil(totalRows * 0.25));
      footerZoneStart = Math.max(totalRows - 2, Math.floor(totalRows * 0.75));
    } else {
      // Larger template - keep first 2 rows and last 2 rows
      headerZoneEnd = 2;
      footerZoneStart = totalRows - 2;
    }
    
    // Ensure footerZoneStart > headerZoneEnd (otherwise nothing to clear)
    if (footerZoneStart <= headerZoneEnd) {
      toast.info("Template zu klein - keine mittleren Inhalte zum Entfernen");
      return;
    }
    
    console.log('[StripText] Zones: header 0-' + headerZoneEnd + ', footer ' + footerZoneStart + '-' + totalRows);
    
    let clearedCount = 0;
    allRows.forEach((row, idx) => {
      const isHeaderZone = idx < headerZoneEnd;
      const isFooterZone = idx >= footerZoneStart;

      if (!isHeaderZone && !isFooterZone) {
        // Middle content: clear all text
        clearTextInElement(row);
        clearedCount++;
      }
    });
    
    console.log('[StripText] Cleared text in', clearedCount, 'rows');
    
    // Sync back in the same format as original input
    if (originalWasFullDocument) {
      let result = doc.documentElement.outerHTML;
      if (/<!doctype\b/i.test(content) && !/^<!doctype\b/i.test(result)) {
        result = `<!doctype html>${result}`;
      }
      onChange(result);
    } else {
      onChange(doc.body?.innerHTML || '');
    }
    toast.success("Mittlerer Inhalt entfernt, Header & Footer beibehalten");
  };

  // AI: Replace placeholders with contextual content
  const handleGenerateContent = async () => {
    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email-content", {
        body: {
          htmlTemplate: content,
          taskTitle: taskTitle || "Demo-Auftrag"
        }
      });
      if (error) throw error;
      if (data?.html) {
        onChange(data.html);
        toast.success("Platzhalter wurden mit KI-Text ersetzt!");
      }
    } catch (err) {
      console.error("Error generating content:", err);
      toast.error("Fehler beim Generieren des Inhalts");
    }
    setGeneratingContent(false);
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
        <Button
          type="button"
          variant={isEditMode ? "default" : "outline"}
          size="sm"
          onClick={() => setIsEditMode(!isEditMode)}
        >
          <MousePointer className="h-4 w-4 mr-1.5" />
          {isEditMode ? "Bearbeitung aktiv" : "Klick-Bearbeitung"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleStripText}
        >
          <Eraser className="h-4 w-4 mr-1.5" />
          Texte entfernen
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            // Remove all img tags from the HTML
            const newHtml = content.replace(/<img[^>]*>/gi, '');
            onChange(newHtml);
            toast.success("Bilder wurden entfernt");
          }}
        >
          <ImageOff className="h-4 w-4 mr-1.5" />
          Bilder entfernen
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerateContent}
          disabled={generatingContent}
        >
          {generatingContent ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1.5" />
          )}
          KI-Inhalt
        </Button>
        <div className="h-4 w-px bg-border mx-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-1.5" />
          )}
          Bild hochladen
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {isEditMode ? "Klicke auf Text in der Vorschau zum Bearbeiten" : "Bilder per Drag & Drop einfügen"}
        </span>
        {selectedImage && (
          <div className="flex items-center gap-3 bg-background border rounded-lg px-3 py-1.5 shadow-sm">
            <span className="text-xs font-medium whitespace-nowrap">Bild ausgewählt:</span>
            
            {/* Replace Image Button */}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => replaceFileInputRef.current?.click()} 
              className="h-7 px-2 bg-primary/10 border-primary/30 hover:bg-primary/20"
              disabled={isReplacing}
            >
              {isReplacing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Replace className="h-3.5 w-3.5 mr-1" />
              )}
              Ersetzen
            </Button>
            <input
              ref={replaceFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReplaceFileSelect}
            />
            
            <div className="h-4 w-px bg-border" />
            
            {/* Size Slider */}
            <span className="text-xs text-muted-foreground whitespace-nowrap">Größe:</span>
            <Slider
              value={[imageScale]}
              onValueChange={handleImageResize}
              min={10}
              max={200}
              step={5}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground w-10">{imageScale}%</span>
            <Button size="sm" variant="default" onClick={applyImageResize} className="h-7 px-2">
              OK
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedImage(null)} className="h-7 px-2">
              ✕
            </Button>
          </div>
        )}
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">HTML-Code</span>
            <span className="text-xs text-muted-foreground">(Bilder hier reinziehen)</span>
          </div>
          <div
            className={`relative ${isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isDragOver && (
              <div className="absolute inset-0 bg-primary/10 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-primary">
                  <ImagePlus className="h-8 w-8" />
                  <span className="font-medium">Bild hier ablegen</span>
                </div>
              </div>
            )}
            <Textarea 
              ref={textareaRef}
              value={content} 
              onChange={(e) => onChange(e.target.value)} 
              className="font-mono text-xs h-[400px]"
              placeholder="HTML-Code eingeben oder Bild hierher ziehen..."
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MousePointer className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Live-Vorschau {isEditMode && <span className="text-primary">(Bearbeitbar)</span>}</span>
            <span className="text-xs text-muted-foreground ml-auto">Bilder hier reinziehen zum Einfügen</span>
          </div>
          <div 
            className={`border rounded-xl bg-white overflow-hidden h-[400px] relative ${isDragOverPreview ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            onDrop={handlePreviewDrop}
            onDragOver={handlePreviewDragOver}
            onDragLeave={handlePreviewDragLeave}
          >
            {isDragOverPreview && (
              <div className="absolute inset-0 bg-primary/20 z-20 flex items-center justify-center pointer-events-none">
                <div className="bg-background/90 rounded-lg px-6 py-4 flex flex-col items-center gap-2 shadow-lg">
                  <ImagePlus className="h-10 w-10 text-primary" />
                  <span className="font-medium text-primary">Bild hier einfügen</span>
                </div>
              </div>
            )}
            <iframe 
              ref={iframeRef}
              srcDoc={getEditableContent()} 
              className="w-full h-full border-0 rounded-xl"
              sandbox="allow-same-origin allow-scripts"
              referrerPolicy="no-referrer"
              key={isEditMode ? 'edit' : 'view'} // Force re-render on mode change
            />
          </div>
        </div>
      </div>
    </div>
  );
}
