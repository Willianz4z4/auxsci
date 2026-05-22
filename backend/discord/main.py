import discord
from discord.ext import commands

# Configuração Básica do Bot
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'✅ Bot conectado como {bot.user}')
    print('🚀 Auxsci Hub Online e pronto para monetizar!')

@bot.command()
async def ping(ctx):
    await ctx.send('Pong! 🏓 O sistema Auxsci está rodando.')

@bot.command()
async def link(ctx, url: str):
    # Futura integração com o seu backend
    await ctx.send(f'🔗 Recebi seu link: `{url}`\nGerando versão monetizada...')

# Coloque o token do seu bot aqui
TOKEN = 'COLOQUE_SEU_TOKEN_AQUI'

if __name__ == "__main__":
    try:
        bot.run(TOKEN)
    except Exception as e:
        print(f"Erro ao iniciar o bot: {e}\nVocê esqueceu de colocar o Token?")
